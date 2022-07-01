// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ExternalTest {

         event ExternalCallReceived(address sender);
         constructor(){

         }
         function externalCallTest() external {
                  emit ExternalCallReceived(msg.sender);
         }
         
}
