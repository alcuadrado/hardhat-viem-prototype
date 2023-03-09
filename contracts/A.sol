// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

contract A {
    function writeANumber(uint _i) public {}

    function returnsString() public pure returns (string memory) {
        return "none";
    }

    function returnsString(
        string calldata s
    ) public pure returns (string memory) {
        return s;
    }
}
