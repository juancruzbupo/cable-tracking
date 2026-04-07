import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../../services/api';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type {
  ClientWithDebt,
  ClientStatus,
  DebtStatus,
  Pagination,
} from '../../../types';

export function useClients() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<ClientStatus | undefined>();
  const [debtStatus, setDebtStatus] = useState<DebtStatus | undefined>();
  const [zona, setZona] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', { search: debouncedSearch || undefined, estado, debtStatus, zona, page }],
    queryFn: () =>
      clientsApi.getAll({
        search: debouncedSearch || undefined,
        estado,
        debtStatus,
        zona,
        page,
        limit: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const clients: ClientWithDebt[] = data?.data ?? [];
  const pagination: Pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 };

  const load = (p = 1) => {
    setPage(p);
    // If same page, force refetch
    if (p === page) refetch();
  };

  return {
    clients,
    pagination,
    loading: isLoading,
    search,
    setSearch,
    estado,
    setEstado,
    debtStatus,
    setDebtStatus,
    zona,
    setZona,
    load,
  };
}

export function useClientDetail() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const { data: detail, isLoading: loading } = useQuery({
    queryKey: ['clientDetail', clientId],
    queryFn: () => clientsApi.getOne(clientId!),
    enabled: !!clientId && open,
  });

  const openDetail = (id: string) => {
    setClientId(id);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
  };

  return { open, loading, detail: detail ?? null, openDetail, close, clientId };
}
