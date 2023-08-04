pragma solidity ^0.8.18;

import {DepositController} from "../../carbon/controllers/DepositController.sol";
import {TransferEnabledController} from "../../carbon/controllers/TransferEnabledController.sol";
import {WithdrawController} from "../../carbon/controllers/WithdrawController.sol";
import {AllowAllLenderVerifier} from "../../carbon/lenderVerifiers/AllowAllLenderVerifier.sol";

contract DepositControllerWrapper is DepositController {}

contract TransferControllerWrapper is TransferEnabledController {}

contract WithdrawControllerWrapper is WithdrawController {}

contract AllowAllLenderVerifierWrapper is AllowAllLenderVerifier {}
