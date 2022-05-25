/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Destroyable} from "./Destroyable.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";

contract AcquisitionManager is Destroyable, Initializable {
    ICustodian public custodian;

    enum OrderStatus {
        UNDEFINED, INIT, OPEN, FAIL, SUCCESS
    };

    mapping(uint256=>OrderInfo) public book;
    
    event OrderOpen();
    event OrderCancel();
    event OrderFail();
    event OrderSuccess();

    
    
    function initialize(address _custodian) public initializer {
        custodian = ICustodian(_custodian);
    }
    
    function request(OrderInfo memory info, bytes memory signature) external payable {
        require(info.isValidRequest(custodian.chainId()), "request not valid");
        require(custodian.checkSignature(info.encodeHash(), signature), "invalid signature");
        require(info.isPaid(), "not fully paid");
        
        releasePreviousInactiveOrder(info.tokenId);

        info.lockPayment();
        
        require(canAddOrder(info), "invalid state");
        appendOrder(info);
    }

    function releasePreviousOrder(uint256 tokenId) internal {
        if(book[tokenId].exists()){
            if(book[tokenId].notAck() && book[tokenId].expired()){
                book[tokenId].refund();
                delete book[tokenId];
            } else if(book[tokenId].ack() && book[tokenId].failed()){
                book[tokenId].refund();
                delete book[tokenId];
            } else {
                revert("Order already active");
            }
        }
        
    }

    function initiate(uint256 tokenId) onlyCustodian {
        require(book[tokenId].exists(), "order does not exist");
        
    }

    function cancel() {

    }

    function success() onlyCustodian {

    }

    function fail() onlyCustodian {

    }
   
}


