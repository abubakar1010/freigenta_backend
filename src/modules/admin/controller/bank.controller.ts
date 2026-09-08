import { Request, Response, NextFunction } from "express";
import { BankAccountService } from "../service/bank.service";

const bankService = new BankAccountService();

export class BankAccountController {
  getAllBanks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const banks = await bankService.getAllBanks();
      res.status(200).json({
        success: true,
        data: banks.map(b => ({
          id: b._id.toString(),
          bankName: b.bankName,
          bankColor: b.bankColor,
          accountHolder: b.accountHolder,
          accountType: b.accountType,
          currency: b.currency,
          accountNumber: b.accountNumber,
          swiftCode: b.swiftCode
        }))
      });
    } catch (error) {
    next(error);
  }
  };

  createBank = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { bankName, bankColor, accountHolder, accountType, currency, accountNumber, swiftCode } = req.body;
      const bank = await bankService.createBank({
        bankName,
        bankColor,
        accountHolder,
        accountType,
        currency,
        accountNumber,
        swiftCode
      });
      res.status(201).json({
        success: true,
        message: "Bank account added successfully.",
        data: {
          id: bank._id.toString(),
          bankName: bank.bankName,
          bankColor: bank.bankColor,
          accountHolder: bank.accountHolder,
          accountType: bank.accountType,
          currency: bank.currency,
          accountNumber: bank.accountNumber,
          swiftCode: bank.swiftCode
        }
      });
    } catch (error) {
    next(error);
  }
  };

  updateBank = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { bankName, bankColor, accountHolder, accountType, currency, accountNumber, swiftCode } = req.body;
      const bank = await bankService.updateBank(id, {
        bankName,
        bankColor,
        accountHolder,
        accountType,
        currency,
        accountNumber,
        swiftCode
      });
      res.status(200).json({
        success: true,
        message: "Bank account updated successfully.",
        data: {
          id: bank._id.toString(),
          bankName: bank.bankName,
          bankColor: bank.bankColor,
          accountHolder: bank.accountHolder,
          accountType: bank.accountType,
          currency: bank.currency,
          accountNumber: bank.accountNumber,
          swiftCode: bank.swiftCode
        }
      });
    } catch (error) {
    next(error);
  }
  };

  deleteBank = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      await bankService.deleteBank(id);
      res.status(200).json({
        success: true,
        message: "Bank account deleted successfully."
      });
    } catch (error) {
    next(error);
  }
  };
}
