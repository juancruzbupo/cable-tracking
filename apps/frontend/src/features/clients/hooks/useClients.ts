import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { clientsApi, getErrorMessage } from '../../../services/api';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type {
  ClientWithDebt,
  ClientDetailResult,
  ClientStatus,
  DebtStatus,
  Pagination,
} from '../../../types';

export function useClients() {
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0, page: 1, limit: 20, totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<ClientStatus | undefined>();
  const [debtStatus, setDebtStatus] = useState<DebtStatus | undefined>();

  const debouncedSearch = useDebounce(search);

  const load = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const res = await clientsApi.getAll({
          search: debouncedSearch || undefined,
          estado,
          debtStatus,
          page,
          limit: 20,
        });
        setClients(res.data);
        setPagination(res.pagination);
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, estado, debtStatus],
  );

  useEffect(() => {
    load();
  }, [load]);

  return {
    clients,
    pagination,
    loading,
    search,
    setSearch,
    estado,
    setEstado,
    debtStatus,
    setDebtStatus,
    load,
  };
}

export function useClientDetail() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ClientDetailResult | null>(null);

  const openDetail = async (id: string) => {
    setOpen(true);
    setLoading(true);
    setDetail(null);
    try {
      const data = await clientsApi.getOne(id);
      setDetail(data);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const close = () => setOpen(false);

  return { open, loading, detail, openDetail, close };
}
