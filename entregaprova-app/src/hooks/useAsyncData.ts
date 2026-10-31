import { useCallback, useEffect, useState } from "react";
import { mensagemDoErro } from "../api/client.ts";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// Carrega dados e informa os 3 estados da tela: carregando, erro ou dados.
// "loader" precisa ser uma função estável (declarada fora do componente).
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (!cancelado) setState({ data, error: null, loading: false });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setState({ data: null, error: mensagemDoErro(erro), loading: false });
      });
    return () => {
      cancelado = true;
    };
  }, [loader, tentativa]);

  const reload = useCallback(() => setTentativa((t) => t + 1), []);
  return { ...state, reload };
}
