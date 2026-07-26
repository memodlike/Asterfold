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

export function NameDialog({ open, title, label, initialValue = "", submitLabel, onClose, onSubmit }: NameDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { if (open) { setValue(initialValue); setError(false); } }, [initialValue, open]);
  const submit = async (): Promise<void> => {
    if (!value.trim()) return;
    setBusy(true);
    setError(false);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} size="small" title={title} onClose={onClose} footer={<><Button onClick={onClose}>{t("generic.cancel")}</Button><Button variant="primary" disabled={busy || !value.trim()} onClick={() => void submit()}>{submitLabel ?? t("generic.save")}</Button></>}>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label>{label}<input autoFocus maxLength={240} value={value} onChange={(event) => setValue(event.target.value)} /></label>
        {error ? <p className="inline-error" role="alert">{t("error.actionFailed")}</p> : null}
      </form>
    </Modal>
  );
}
