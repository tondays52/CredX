// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RWAInvoiceFinancing
 * @notice Businesses can tokenize accounts receivable and get funding.
 *         The discount rate is based on the business's CredXHub credit score.
 */
contract RWAInvoiceFinancing {
    using SafeERC20 for IERC20;

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable PAYMENT_TOKEN;

    struct Invoice {
        address business;
        address funder;
        uint256 faceValue;
        uint256 fundedAmount;
        uint256 duration;
        uint256 createdAt;
        bool isFunded;
        bool isRepaid;
    }

    uint256 public nextInvoiceId;
    mapping(uint256 invoiceId => Invoice invoice) public invoices;

    event InvoiceCreated(uint256 indexed invoiceId, address indexed business, uint256 faceValue);
    event InvoiceFunded(uint256 indexed invoiceId, address indexed funder, uint256 fundedAmount);
    event InvoiceRepaid(uint256 indexed invoiceId, address indexed business);

    constructor(address _credXHub, address _paymentToken) {
        require(_credXHub != address(0), "Invalid CredXHub");
        require(_paymentToken != address(0), "Invalid PaymentToken");
        CREDX_HUB = ICredXHub(_credXHub);
        PAYMENT_TOKEN = IERC20(_paymentToken);
    }

    function tokenizeInvoice(uint256 faceValue, uint256 duration) external returns (uint256) {
        require(faceValue > 0, "Face value must be > 0");
        
        uint256 invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice({
            business: msg.sender,
            funder: address(0),
            faceValue: faceValue,
            fundedAmount: 0,
            duration: duration,
            createdAt: block.timestamp,
            isFunded: false,
            isRepaid: false
        });

        emit InvoiceCreated(invoiceId, msg.sender, faceValue);
        return invoiceId;
    }

    function fundInvoice(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.business != address(0), "Invoice does not exist");
        require(!invoice.isFunded, "Already funded");
        require(invoice.business != msg.sender, "Cannot fund own invoice");

        // Discount based on credit score
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(invoice.business);
        
        // Base funding amount is 80% of face value (20% discount/interest)
        uint256 baseFundRatio = 8000; // 80%

        // High credit score gets better terms (up to 95% funding amount)
        if (creditScore >= 700) {
            baseFundRatio = 9500; // 95%
        } else if (creditScore >= 500) {
            baseFundRatio = 9000; // 90%
        }

        uint256 fundedAmount = (invoice.faceValue * baseFundRatio) / 10000;
        
        invoice.funder = msg.sender;
        invoice.fundedAmount = fundedAmount;
        invoice.isFunded = true;

        PAYMENT_TOKEN.safeTransferFrom(msg.sender, invoice.business, fundedAmount);

        emit InvoiceFunded(invoiceId, msg.sender, fundedAmount);
    }

    function repayInvoice(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.isFunded, "Not funded");
        require(!invoice.isRepaid, "Already repaid");

        invoice.isRepaid = true;
        
        // Business repays the full face value to the funder
        PAYMENT_TOKEN.safeTransferFrom(msg.sender, invoice.funder, invoice.faceValue);

        emit InvoiceRepaid(invoiceId, msg.sender);
    }
}
