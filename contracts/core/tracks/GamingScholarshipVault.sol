// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GamingScholarshipVault
 * @notice Vault for zero-collateral NFT scholarships based on gaming reputation.
 */
contract GamingScholarshipVault is IERC721Receiver {
    // Custom Errors
    error ZeroAddress();
    error NFTNotInVault();
    error NFTAlreadyBorrowed();
    error ScoreTooLowForScholarship();
    error NotTheBorrower();

    ICredXHub public immutable CREDX_HUB;
    uint256 public constant MIN_SCORE_FOR_SCHOLARSHIP = 700;

    struct BorrowRecord {
        address borrower;
        uint256 borrowedAtBlock;
        address originalOwner;
    }

    // nftContract => tokenId => BorrowRecord
    mapping(address nftContract => mapping(uint256 tokenId => BorrowRecord record)) public activeBorrows;

    event NFTDeposited(address indexed owner, address indexed nftContract, uint256 tokenId);
    event NFTBorrowed(address indexed borrower, address indexed nftContract, uint256 tokenId);
    event NFTReturned(address indexed borrower, address indexed nftContract, uint256 tokenId);

    constructor(address _credXHub) {
        if (_credXHub == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
    }

    function depositNFT(address nftContract, uint256 tokenId) external {
        if (nftContract == address(0)) {
            revert ZeroAddress();
        }
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        
        // We set the borrower to address(0) to signify it's available, and track originalOwner
        activeBorrows[nftContract][tokenId] = BorrowRecord({
            borrower: address(0),
            borrowedAtBlock: 0,
            originalOwner: msg.sender
        });

        emit NFTDeposited(msg.sender, nftContract, tokenId);
    }

    function borrowNFT(address nftContract, uint256 tokenId) external {
        if (nftContract == address(0)) {
            revert ZeroAddress();
        }
        BorrowRecord storage record = activeBorrows[nftContract][tokenId];
        if (record.originalOwner == address(0)) {
            revert NFTNotInVault();
        }
        if (record.borrower != address(0)) {
            revert NFTAlreadyBorrowed();
        }

        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        if (creditScore < MIN_SCORE_FOR_SCHOLARSHIP) {
            revert ScoreTooLowForScholarship();
        }

        record.borrower = msg.sender;
        record.borrowedAtBlock = block.number;

        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        emit NFTBorrowed(msg.sender, nftContract, tokenId);
    }

    function returnNFT(address nftContract, uint256 tokenId) external {
        if (nftContract == address(0)) {
            revert ZeroAddress();
        }
        BorrowRecord storage record = activeBorrows[nftContract][tokenId];
        if (record.borrower != msg.sender) {
            revert NotTheBorrower();
        }

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        record.borrower = address(0);
        record.borrowedAtBlock = 0;

        emit NFTReturned(msg.sender, nftContract, tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
