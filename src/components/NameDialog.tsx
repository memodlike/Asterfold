import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useI18n } from "../i18n";

interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
}

export function NameDialog({ open, title, label, initialValue = "", submitLabel = "Save", onClose, onSubmit }: NameDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setValue(initialValue); }, [initialValue, open]);
  const submit = async (): Promise<void> => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} size="small" title={title} onClose={onClose} footer={<><Button onClick={onClose}>{t("generic.cancel")}</Button><Button variant="primary" disabled={busy || !value.trim()} onClick={() => void submit()}>{submitLabel}</Button></>}>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label>{label}<input autoFocus maxLength={240} value={value} onChange={(event) => setValue(event.target.value)} /></label></form>
    </Modal>
  );
}
