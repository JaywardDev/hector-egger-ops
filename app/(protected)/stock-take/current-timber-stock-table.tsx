"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import {
  formatStockLocationLabel,
  formatTimberStockLabel,
} from "@/src/lib/stock-take/timber-stock-formatting";
import type { CurrentTimberStockBalance } from "@/src/lib/stock-take/timber-stock";

type CurrentTimberStockTableProps = {
  balances: CurrentTimberStockBalance[];
};

const formatQuantity = (quantity: number, unit: string) =>
  `${new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`;

const formatLastCounted = (value: string) =>
  new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function CurrentTimberStockTable({ balances }: CurrentTimberStockTableProps) {
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  const locations = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const balance of balances) {
      const key = balance.stockLocationId ?? "__none__";
      byKey.set(key, formatStockLocationLabel(balance.stockLocation));
    }
    return [...byKey.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [balances]);

  const filteredBalances = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return balances.filter((balance) => {
      const locationKey = balance.stockLocationId ?? "__none__";
      if (locationFilter !== "all" && locationFilter !== locationKey) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        balance.itemName,
        balance.itemCode,
        balance.timberSpec?.thickness_mm,
        balance.timberSpec?.width_mm,
        balance.timberSpec?.length_mm,
        balance.timberSpec?.grade,
        balance.timberSpec?.treatment,
        formatStockLocationLabel(balance.stockLocation),
      ]
        .filter((part) => part !== null && part !== undefined)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [balances, locationFilter, query]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Input
          aria-label="Search current timber stock"
          placeholder="Search by timber, code, spec, or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="Filter by location"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
        >
          <option value="all">All locations</option>
          {locations.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
      </div>

      {filteredBalances.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
          No timber stock matches the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Timber/spec</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2">Last counted</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredBalances.map((balance) => {
                const updateParams = new URLSearchParams({
                  itemId: balance.inventoryItemId,
                });
                if (balance.stockLocationId) {
                  updateParams.set("locationId", balance.stockLocationId);
                } else {
                  updateParams.set("location", "none");
                }

                return (
                  <tr key={`${balance.inventoryItemId}:${balance.stockLocationId ?? "none"}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">
                        {formatTimberStockLabel({
                          name: balance.itemName,
                          itemCode: balance.itemCode,
                          timberSpec: balance.timberSpec,
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {formatStockLocationLabel(balance.stockLocation)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900">
                      {formatQuantity(balance.quantity, balance.unit)}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {formatLastCounted(balance.lastFinalizedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                        href={`/stock-take?${updateParams.toString()}#add-update-timber`}
                      >
                        Update
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
