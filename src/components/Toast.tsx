import { AlertIcon } from "./Icons";

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        <AlertIcon size={14} />
      </span>
      <span>{message}</span>
    </div>
  );
}
