import React, { useCallback, useMemo, useState } from "react";
import Head from "next/head";
import { Connection, PublicKey } from "@solana/web3.js";

type TxRow = {
  signature: string;
  timestamp: number | null;
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

async function getLastTransactions(rpcUrl: string, address: string, max: number): Promise<TxRow[]> {
  const connection = new Connection(rpcUrl, "confirmed");
  const pubkey = new PublicKey(address);
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: max });
  return signatures.map((s) => ({
    signature: s.signature,
    timestamp: s.blockTime ?? null,
  }));
}

export default function HomePage() {
  const [rpcUrl, setRpcUrl] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<RpcStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TxRow[]>([]);

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
      const data = await getLastTransactions(rpcUrl.trim(), address.trim(), 10);
      setRows(data);
      setStatus("success");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch transactions");
      setStatus("error");
    }
  }, [rpcUrl, address]);

  const cluster = useMemo(() => clusterFromRpcUrl(rpcUrl), [rpcUrl]);

  return (
    <>
      <Head>
        <title>Solana Transactions</title>
      </Head>
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-solanaPurple to-solanaBlue">
              Last 10 Transactions
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              Enter an RPC URL and a wallet address to view the last 10 transactions.
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
                {status === "loading" ? "Fetching..." : "Fetch Transactions"}
              </button>
              {status === "error" && error && (
                <span className="text-red-300 text-sm">{error}</span>
              )}
              {status === "success" && rows.length === 0 && (
                <span className="text-gray-300 text-sm">No transactions found.</span>
              )}
            </div>
          </section>

          <section className="card p-4 md:p-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300">
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
                        {r.timestamp ? new Date(r.timestamp * 1000).toLocaleString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <footer className="text-center text-xs text-white/70">
            Powered by Solana RPC.
          </footer>
        </div>
      </div>
    </>
  );
}

function shortSignature(sig: string, n = 6) {
  return sig.length > 16 ? `${sig.slice(0, n)}...${sig.slice(-n)}` : sig;
}