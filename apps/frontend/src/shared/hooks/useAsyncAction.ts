import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getErrorMessage } from '../../services/api';

export function useAsyncAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  options?: { successMessage?: string; onSuccess?: () => void }
) {
  const [loading, setLoading] = useState(false);
  const execute = useCallback(async (...args: Parameters<T>) => {
    setLoading(true);
    try {
      const result = await action(...args);
      if (options?.successMessage) message.success(options.successMessage);
      options?.onSuccess?.();
      return result;
    } catch (err) {
      message.error(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [action, options?.successMessage, options?.onSuccess]) as T;
  return { execute, loading };
}
