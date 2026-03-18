import { useState, useMemo } from 'react';
import type { RegistryAsset } from '../../registry/types.js';
export type { AssetType } from '../../adapters/types.js';
import type { AssetType } from '../../adapters/types.js';

interface UseFilterResult {
  search: string;
  setSearch: (value: string) => void;
  typeFilter: AssetType | null;
  setTypeFilter: (value: AssetType | null) => void;
  targetFilter: string | null;
  setTargetFilter: (value: string | null) => void;
  filtered: RegistryAsset[];
}

export function useFilter(assets: RegistryAsset[]): UseFilterResult {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [targetFilter, setTargetFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = assets;

    if (typeFilter) {
      result = result.filter((a) => a.type === typeFilter);
    }

    if (targetFilter) {
      result = result.filter((a) => a.targets.includes(targetFilter));
    }

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [assets, search, typeFilter, targetFilter]);

  return {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    targetFilter,
    setTargetFilter,
    filtered,
  };
}
