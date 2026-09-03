import { forwardRef } from "react";
import { controlClasses, labelClasses, errorTextClasses } from "./fieldClasses";

export const Input = forwardRef(function Input(
  { label, labelClassName, error, tone = "light", className = "", containerClassName = "", ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses({ className: labelClassName })}>{label}</label>}
      <input ref={ref} className={controlClasses({ error, className, tone })} {...props} />
      {error && <p className={errorTextClasses}>{error}</p>}
    </div>
  );
});
