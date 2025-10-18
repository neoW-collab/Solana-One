import React, { useCallback, useMemo, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

type TransferRow = {
  signature: string;
  timestamp: number | null;
  mint: string | null;
  symbol: string | null;
  name: string | null;
  amount: number | null;
  decimals: number | null;
  from: string | null;
  to: string | null;
};

type RpcStatus = "idle" | "loading" | "error" | "success";

const SOLSCAN_BASE = "https://solscan.io/tx/";

function clusterFromRpcUrl(url: string): "mainnet" | "devnet" | "testnet" | undefined {
  const u = url.toLowerCase();
  if (u.includes("devnet")) return "devnet";
  if (u.includes("testnet")) return "testnet";
  if (u.includes("mainnet")) return "mainnet";
  return undefined;
}

async function fetchTokenList(): Promise<Record<string, { symbol: string; name: string }>> {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json"
    );
    const data = await res.json();
    const map: Record<string, { symbol: string; name: string }> = {};
    for (const t of data.tokens || []) {
      map[t.address] = { symbol: t.symbol, name: t.name };
    }
    return map;
  } catch {
    return {};
  }
}

async function getTransfersForAddress(rpcUrl: string, address: string, max: number): Promise<TransferRow[]> {
  const connection = new Connection(rpcUrl, "confirmed");
  const pubkey = new PublicKey(address);
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 50 });
  const out: TransferRow[] = [];
  const tokenList = await fetchTokenList();

  for (const sigInfo of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;

      const blockTime = tx.blockTime ?? null;
      const signature = sigInfo.signature;
      const instructions = tx.transaction.message.instructions as any[];

      for (const ix of instructions) {
        // We only care about parsed instructions with a transfer of SPL tokens
        const parsed = ix?.parsed;
        const type = parsed?.type;
        if (type === "transferChecked" || type === "transfer") {
          const info = parsed?.info || {};
          const source = info.source || info.owner || null;
          const destination = info.destination || null;
          const mint = info.mint || null;
          const decimals = typeof info.decimals === "number" ? info.decimals : null;
          const rawAmountStr = info.tokenAmount?.amount ?? info.amount ?? null;

          let amount: number | null = null;
          if (rawAmountStr !== null) {
            const n = Number(rawAmountStr);
            if (Number.isFinite(n)) {
              amount = decimals != null ? n / 10 ** decimals : n;
            }
          }

          const meta = mint ? tokenList[mint] : undefined;

          out.push({
            signature,
            timestamp: blockTime,
            mint,
            symbol: meta?.symbol ?? null,
            name: meta?.name ?? null,
            amount,
            decimals,
            from: source,
            to: destination,
          });

          if (out.length >= max) break;
        }
      }
      if (out.length >= max) break;
    } catch {
      // ignore individual transaction parse errors
    }
  }

  return out.slice(0, max);
}

export default function App() {
  const [rpcUrl, setRpcUrl] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<RpcStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TransferRow[]>([]);

  const isValidUrl = useMemo(() => {
    try {
      const u = new URL(rpcUrl);
      return ["http:", "https:"].includes(u.protocol);
    } catch {
      return false;
    }
  }, [rpcUrl]);

  const isValidAddress = useMemo(() => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }, [address]);

  const disabled = !isValidUrl || !isValidAddress || status === "loading";

  const onFetch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setRows([]);
    try {
      const data = await getTransfersForAddress(rpcUrl.trim(), address.trim(), 10);
      setRows(data);
      setStatus("success");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch transfers");
      setStatus("error");
    }
  }, [rpcUrl, address]);

  const cluster = useMemo(() => clusterFromRpcUrl(rpcUrl), [rpcUrl]);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-solanaPurple to-solanaBlue">
            Solana Token Transfers Viewer
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            Enter an RPC URL and a wallet address to view the last 10 SPL token transfers.
          </p>
        </header>

        <section className="card p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Solana RPC URL</label>
              <input
                type="url"
                placeholder="https://api.mainnet-beta.solana.com"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-solanaPurple"
              />
              {!isValidUrl && rpcUrl.length > 0 && (
                <p className="mt-1 text-xs text-red-300">Enter a valid HTTP(s) RPC URL.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Wallet Address</label>
              <input
                type="text"
                placeholder="Enter a public key (base58)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-solanaPurple"
              />
              {!isValidAddress && address.length > 0 && (
                <p className="mt-1 text-xs text-red-300">Enter a valid Solana address.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onFetch}
              disabled={disabled}
              className={`rounded-lg px-4 py-2 font-semibold text-white transition ${
                disabled
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-solanaPurple to-solanaBlue hover:opacity-90"
              }`}
            >
              {status === "loading" ? "Fetching..." : "Fetch Transfers"}
            </button>
            {status === "error" && error && (
              <span className="text-red-300 text-sm">{error}</span>
            )}
            {status === "success" && rows.length === 0 && (
              <span className="text-gray-300 text-sm">No transfers found.</span>
            )}
          </div>
        </section>

        <section className="card p-4 md:p-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-300">
                <th className="py-2 pr-4">Token</th>
                <th className="py-2 pr-4">Symbol</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Signature</th>
                <th className="py-2 pr-4">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const solscanUrl =
                  SOLSCAN_BASE +
                  r.signature +
                  (cluster ? `?cluster=${cluster === "mainnet" ? "mainnet" : cluster}` : "");
                return (
                  <tr key={r.signature + idx} className="border-t border-white/10">
                    <td className="py-2 pr-4">{r.name ?? (r.mint ?? "-")}</td>
                    <td className="py-2 pr-4">{r.symbol ?? "-"}</td>
                    <td className="py-2 pr-4">
                      {r.amount != null
                        ? r.amount.toLocaleString(undefined, {
                            maximumFractionDigits: r.decimals != null ? Math.min(r.decimals, 9) : 9,
                          })
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {r.from ? (
                        <span title={r.from}>{shortAddress(r.from)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {r.to ? (
                        <span title={r.to}>{shortAddress(r.to)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <a
                        href={solscanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-solanaBlue hover:underline"
                        title={r.signature}
                      >
                        {shortSignature(r.signature)}
                      </a>
                    </td>
                    <td className="py-2 pr-4">
                      {r.timestamp
                        ? new Date(r.timestamp * 1000).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <footer className="text-center text-xs text-white/70">
          Powered by Solana RPC. Parsed SPL token transfers only.
        </footer>
      </div>
    </div>
  );
}

function shortAddress(addr: string, n = 4) {
  return addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}
function shortSignature(sig: string, n = 6) {
  return sig.length > 16 ? `${sig.slice(0, n)}...${sig.slice(-n)}` : sig;
}