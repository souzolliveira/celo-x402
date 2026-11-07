import { getDb } from "@/lib/db";
import { formatUsdc, parseUsdc } from "@/lib/usdc";

const DEFAULT_LOW_BALANCE = parseUsdc("1")!;

export type CreditAccount = {
  wallet: string;
  email: string;
  balanceAtomic: bigint;
  lowBalanceAtomic: bigint;
  topupNotified: boolean;
};

type AccountRow = {
  wallet: string;
  email: string;
  balance_atomic: string;
  low_balance_atomic: string;
  topup_notified: number;
};

export type TopupNotice = {
  email: string;
  balance: string;
  lowBalance: string;
};

export function openCreditAccount(input: { wallet: string; email: string; lowBalance?: string }): CreditAccount {
  const wallet = input.wallet.trim();
  const email = input.email.trim();
  const low = input.lowBalance ? parseUsdc(input.lowBalance) : DEFAULT_LOW_BALANCE;
  if (!wallet || !email || low === null) {
    throw new Error("Account needs a wallet, an email, and a low-balance limit greater than zero.");
  }

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO credit_account (wallet, email, balance_atomic, low_balance_atomic, topup_notified, updated_at)
       VALUES (?, ?, '0', ?, 0, ?)
       ON CONFLICT(wallet) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`,
    )
    .run(wallet, email, low.toString(), now);

  return mustAccount(wallet);
}

export function recordOnchainDeposit(input: { wallet: string; amount: string; txHash: string }): CreditAccount {
  const amount = parseUsdc(input.amount);
  const txHash = input.txHash.trim();
  if (amount === null || !txHash) {
    throw new Error("Onchain deposit needs a positive USDC amount and a transaction hash.");
  }

  const account = mustAccount(input.wallet.trim());
  const next = account.balanceAtomic + amount;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO credit_purchase (wallet, channel, amount_atomic, tx_hash, created_at)
       VALUES (?, 'onchain', ?, ?, ?)`,
    )
    .run(account.wallet, amount.toString(), txHash, now);
  writeBalance(account.wallet, next, now);
  return mustAccount(account.wallet);
}

export function recordSpend(input: { wallet: string; service: string; amount: string }): {
  account: CreditAccount;
  topup: TopupNotice | null;
} {
  const service = input.service.trim();
  const amount = parseUsdc(input.amount);
  if (!service || amount === null) {
    throw new Error("Spend needs a service name and a positive USDC amount.");
  }

  const account = mustAccount(input.wallet.trim());
  if (account.balanceAtomic < amount) {
    throw new Error("Not enough credits.");
  }

  const next = account.balanceAtomic - amount;
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(`INSERT INTO spend (wallet, service, amount_atomic, created_at) VALUES (?, ?, ?, ?)`).run(
    account.wallet,
    service,
    amount.toString(),
    now,
  );
  writeBalance(account.wallet, next, now);

  const updated = mustAccount(account.wallet);
  const crossed = updated.balanceAtomic < updated.lowBalanceAtomic && !updated.topupNotified;
  if (!crossed) return { account: updated, topup: null };

  db.prepare("UPDATE credit_account SET topup_notified = 1, updated_at = ? WHERE wallet = ?").run(now, updated.wallet);
  return {
    account: mustAccount(updated.wallet),
    topup: {
      email: updated.email,
      balance: formatUsdc(updated.balanceAtomic),
      lowBalance: formatUsdc(updated.lowBalanceAtomic),
    },
  };
}

function writeBalance(wallet: string, balance: bigint, updatedAt: string) {
  const aboveLimit = balance >= mustAccount(wallet).lowBalanceAtomic;
  if (aboveLimit) {
    getDb()
      .prepare("UPDATE credit_account SET balance_atomic = ?, topup_notified = 0, updated_at = ? WHERE wallet = ?")
      .run(balance.toString(), updatedAt, wallet);
    return;
  }
  getDb()
    .prepare("UPDATE credit_account SET balance_atomic = ?, updated_at = ? WHERE wallet = ?")
    .run(balance.toString(), updatedAt, wallet);
}

function mustAccount(wallet: string): CreditAccount {
  const row = getDb()
    .prepare(
      "SELECT wallet, email, balance_atomic, low_balance_atomic, topup_notified FROM credit_account WHERE wallet = ?",
    )
    .get(wallet) as AccountRow | undefined;
  if (!row) throw new Error("Open an account before moving credits.");
  return {
    wallet: row.wallet,
    email: row.email,
    balanceAtomic: BigInt(row.balance_atomic),
    lowBalanceAtomic: BigInt(row.low_balance_atomic),
    topupNotified: row.topup_notified === 1,
  };
}
