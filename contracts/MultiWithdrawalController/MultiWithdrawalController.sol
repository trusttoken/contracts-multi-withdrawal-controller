// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import {IWithdrawController, WithdrawalException} from "./IWithdrawController.sol";
import {Status, WithdrawAllowed} from "../carbon/interfaces/IWithdrawController.sol";
import {ITrancheVault} from "../carbon/interfaces/ITrancheVault.sol";
import {IStructuredPortfolio} from "../carbon/interfaces/IStructuredPortfolio.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract MultiWithdrawalController is IWithdrawController, Initializable, AccessControlEnumerable {
    /// @dev Manager role used for access control
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public floor;
    mapping(Status => bool) public withdrawAllowed;
    WithdrawalException public withdrawalException;
    uint256 constant ONE_IN_BASIS_POINTS = 10000;

    modifier onlyManager() {
        require(hasRole(MANAGER_ROLE, msg.sender), "MWC: Only manager");
        _;
    }

    constructor() {}

    function initialize(address manager, uint256 _floor) external initializer {
        _grantRole(MANAGER_ROLE, manager);
        withdrawAllowed[Status.Closed] = true;
        floor = _floor;
    }

    function multiRedeem(address vault, WithdrawalException[] memory exceptions) external onlyManager {
        require(exceptions.length > 0, "MWC: Exceptions array cannot be empty");
        ITrancheVault trancheVault = ITrancheVault(vault);
        require(!withdrawAllowed[trancheVault.portfolio().status()], "MWC: Only available when redemptions are disabled for lenders");

        for (uint256 i = 0; i < exceptions.length; i++) {
            withdrawalException = exceptions[i];
            trancheVault.redeem(exceptions[i].shareAmount, exceptions[i].lender, exceptions[i].lender);
        }
        delete withdrawalException;
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        ITrancheVault vault = ITrancheVault(msg.sender);
        Status status = vault.portfolio().status();

        uint256 ownerShares = vault.balanceOf(owner);
        uint256 userMaxWithdraw = vault.convertToAssets(ownerShares);
        if (status == Status.Closed) {
            return userMaxWithdraw;
        }

        uint256 globalMaxWithdraw = _globalMaxWithdraw(vault);
        return Math.min(userMaxWithdraw, globalMaxWithdraw);
    }

    function _getExceptionForWithdrawal(address owner) internal view returns (WithdrawalException memory exception) {
        exception = withdrawalException;
        require(exception.lender == owner, "MWC: No withdrawal exception for this address");
    }

    function _calculateExceptionRedeem(
        uint256 shares,
        uint256 price,
        uint256 feeBps
    ) internal pure returns (uint256 amount, uint256 fee) {
        amount = (shares * price) / ONE_IN_BASIS_POINTS;
        fee = _calculateSubtractedFee(amount, feeBps);
        amount -= fee;
    }

    function _calculateSubtractedFee(uint256 amount, uint256 feeInBasisPoints) internal pure returns (uint256) {
        return (amount * feeInBasisPoints) / ONE_IN_BASIS_POINTS;
    }

    function maxRedeem(address owner) external view returns (uint256) {
        ITrancheVault vault = ITrancheVault(msg.sender);
        Status status = vault.portfolio().status();

        uint256 userMaxRedeem = vault.balanceOf(owner);
        if (status == Status.Closed) {
            return userMaxRedeem;
        }

        uint256 globalMaxWithdraw = _globalMaxWithdraw(vault);
        uint256 globalMaxRedeem = vault.convertToShares(globalMaxWithdraw);
        return Math.min(userMaxRedeem, globalMaxRedeem);
    }

    function _globalMaxWithdraw(ITrancheVault vault) internal view returns (uint256) {
        uint256 totalAssets = vault.totalAssets();
        return totalAssets > floor ? totalAssets - floor : 0;
    }

    function onWithdraw(
        address,
        uint256 assets,
        address,
        address
    ) external view returns (uint256 shares, uint256 fee) {
        ITrancheVault vault = ITrancheVault(msg.sender);
        Status status = vault.portfolio().status();
        require(withdrawAllowed[status], "MWC: Withdrawals are not allowed");

        shares = previewWithdraw(assets);
        _ensureFloorRemains(vault, status, assets + fee);
    }

    function onRedeem(
        address sender,
        uint256 shares,
        address,
        address owner
    ) external view returns (uint256 assets, uint256 fee) {
        ITrancheVault vault = ITrancheVault(msg.sender);

        Status status = vault.portfolio().status();
        if (withdrawAllowed[status]) {
            assets = previewRedeem(shares);
        } else {
            require(sender == address(this), "MWC: Only controller can withdraw based on exception");
            WithdrawalException memory exception = _getExceptionForWithdrawal(owner);
            assert(shares == exception.shareAmount);
            (assets, fee) = _calculateExceptionRedeem(shares, exception.sharePrice, exception.fee);
        }

        _ensureFloorRemains(vault, status, assets + fee);
    }

    function _ensureFloorRemains(
        ITrancheVault vault,
        Status status,
        uint256 amount
    ) internal view {
        if (status == Status.Closed) {
            return;
        }
        uint256 globalMaxWithdraw = _globalMaxWithdraw(vault);
        require(amount <= globalMaxWithdraw, "MWC: Remaining amount below floor");
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return ITrancheVault(msg.sender).convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return ITrancheVault(msg.sender).convertToSharesCeil(assets);
    }

    function setFloor(uint256 newFloor) public onlyManager {
        floor = newFloor;
        emit FloorChanged(newFloor);
    }

    function setWithdrawAllowed(bool newWithdrawAllowed, Status portfolioStatus) public onlyManager {
        withdrawAllowed[portfolioStatus] = newWithdrawAllowed;
        emit WithdrawAllowedChanged(newWithdrawAllowed, portfolioStatus);
    }

    function configure(uint256 newFloor, WithdrawAllowed memory newWithdrawAllowed) external {
        if (floor != newFloor) {
            setFloor(newFloor);
        }
        if (withdrawAllowed[newWithdrawAllowed.status] != newWithdrawAllowed.value) {
            setWithdrawAllowed(newWithdrawAllowed.value, newWithdrawAllowed.status);
        }
    }
}
