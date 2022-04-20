// SPDX-License-Identifier: MIT

import { Domain } from '../libraries/Domain.sol';

interface IDomainTokenBase {
    function getTokenIdByName(string memory) external view returns(uint256);
    function getDomainInfo(string memory) external view returns(Domain.Domain memory);
    function fulfillWithdraw(uint256) external;
    function cancelWithdrawRequest(uint256) external;
    function requestWithdraw(uint256) external;
    function setCustodianLock(uint256, bool) external;
    function setLock(uint256, bool) external;
    function setCustodian(address) external;
}
