import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "medium";
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "medium", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`} {...props}>
      {icon ? <span className="button__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
