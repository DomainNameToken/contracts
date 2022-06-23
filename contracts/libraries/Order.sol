// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataStructs} from "./DataStructs.sol";

library Order {
    function isInitiated(DataStructs.Order memory order) internal view returns(bool){
        return  uint256(order.status) == uint256(DataStructs.OrderStatus.INITIATED);
    }
    function isOpen(DataStructs.Order memory order) internal view returns(bool){
        return uint256(order.status) == uint256(DataStructs.OrderStatus.OPEN);
    }
    function isExpired(DataStructs.Order memory order) internal view returns(bool){
        return isInitiated(order)
            && order.openTime + info.openWindow < block.timestamp;
    }
    function isRefunded(DataStructs.Order memory order) internal view returns(bool){
        return uint256(order.status) == uint256(DataStructs.OrderStatus.REFUNDED);
    }
    function isSuccessful(DataStructs.Order memory order) internal view returns(bool) {
        return uint256(order.status) == uint256(DataStructs.OrderStatus.SUCCESS);
    }
    
    function isFailed(DataStructs.Order memory order) internal view returns(bool) {
        return uint256(order.status) == uint256(DataStructs.OrderStatus.FAILED);
    }

    function shouldRefund(DataStructs.Order memory order) internal view returns(bool){
        return !isRefunded(order)
            && (isFailed(order)
                || isOpen());
    }
    
    function refund(DataStructs.Order storage order) internal returns(bool) {
        if(shouldRefund(order)){
            if(order.paymentToken == address(0)){
                order.status = DataStructs.OrderStatus.REFUNDED;
                (bool success,) = order.customer.call.value(order.paymentAmount)("");
                return success;
            }
        }
        revert("not refundable");
    }
}
