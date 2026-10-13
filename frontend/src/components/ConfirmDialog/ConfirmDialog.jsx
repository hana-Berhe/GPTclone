import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

// Uses the native <dialog> element: it traps focus and closes on Escape.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === dialogRef.current && onCancel()}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{children}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
