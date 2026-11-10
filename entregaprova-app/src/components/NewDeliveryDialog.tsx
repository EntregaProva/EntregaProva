import { useEffect, useRef, type FormEvent } from "react";

export interface NewDeliveryData {
  recipient: string;
  invoice: string;
  date: string;
}

interface NewDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: NewDeliveryData) => void;
}

export default function NewDeliveryDialog({ open, onClose, onSave }: NewDeliveryDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const recipient = String(data.get("recipient") ?? "").trim();
    const invoice = String(data.get("invoice") ?? "").trim();
    const date = String(data.get("date") ?? "");
    if (!recipient || !invoice || !date) return;
    onSave({ recipient, invoice, date });
    form.reset();
  };

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="dialog-head">
          <div>
            <p className="eyebrow">NOVA OPERAÇÃO</p>
            <h2>Registrar entrega</h2>
          </div>
          <button type="button" className="close-btn" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        <label htmlFor="recipient">Destinatário</label>
        <input id="recipient" name="recipient" required placeholder="Ex.: Mercado Central" />
        <label htmlFor="invoice">Número da NF-e / CT-e</label>
        <input id="invoice" name="invoice" required placeholder="Ex.: 35292" />
        <label htmlFor="deliveryDate">Data da entrega</label>
        <input id="deliveryDate" name="date" type="date" required />
        <button className="button primary full" type="submit">
          Salvar entrega
        </button>
      </form>
    </dialog>
  );
}
