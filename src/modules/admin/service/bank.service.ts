import { BankAccount, IBankAccount } from "../models/bank.model";
import { AppError } from "../../../shared/utils/AppError";

export class BankAccountService {
  async getAllBanks(): Promise<IBankAccount[]> {
    let list = await BankAccount.find({}).sort({ createdAt: 1 });
    if (list.length === 0) {
      // Auto seed default corporate banks on first call
      const GTB = new BankAccount({
        bankName: "GTBank",
        bankColor: "bg-[#f97316]", // Orange
        accountHolder: "Cicero Corporate Logistics Ltd",
        accountType: "Current Account",
        currency: "USD",
        accountNumber: "5422 1827 7212",
        swiftCode: "GTBINGLA"
      });
      const STAN = new BankAccount({
        bankName: "Stan Bank",
        bankColor: "bg-[#3b82f6]", // Blue
        accountHolder: "Cicero Corporate Liquidity Fund",
        accountType: "Current Account",
        currency: "USD",
        accountNumber: "8912 0012 3991",
        swiftCode: "SBICNGXX"
      });
      await Promise.all([GTB.save(), STAN.save()]);
      list = [GTB, STAN];
    }
    return list;
  }

  async createBank(data: {
    bankName: string;
    bankColor?: string;
    accountHolder: string;
    accountType?: string;
    currency?: string;
    accountNumber: string;
    swiftCode?: string;
  }): Promise<IBankAccount> {
    if (!data.bankName || !data.accountHolder || !data.accountNumber) {
      throw new AppError("Bank name, account holder, and account number are required fields.", 400);
    }
    const bank = new BankAccount(data);
    return bank.save();
  }

  async updateBank(id: string, data: {
    bankName?: string;
    bankColor?: string;
    accountHolder?: string;
    accountType?: string;
    currency?: string;
    accountNumber?: string;
    swiftCode?: string;
  }): Promise<IBankAccount> {
    const bank = await BankAccount.findById(id);
    if (!bank) {
      throw new AppError("Bank account details not found.", 404);
    }

    if (data.bankName !== undefined) bank.bankName = data.bankName;
    if (data.bankColor !== undefined) bank.bankColor = data.bankColor;
    if (data.accountHolder !== undefined) bank.accountHolder = data.accountHolder;
    if (data.accountType !== undefined) bank.accountType = data.accountType;
    if (data.currency !== undefined) bank.currency = data.currency;
    if (data.accountNumber !== undefined) bank.accountNumber = data.accountNumber;
    if (data.swiftCode !== undefined) bank.swiftCode = data.swiftCode;

    return bank.save();
  }

  async deleteBank(id: string): Promise<void> {
    const bank = await BankAccount.findById(id);
    if (!bank) {
      throw new AppError("Bank account details not found.", 404);
    }
    await BankAccount.deleteOne({ _id: id });
  }
}
