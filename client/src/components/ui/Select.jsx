import { forwardRef } from "react";
import { controlClasses, labelClasses, errorTextClasses } from "./fieldClasses";

export const Select = forwardRef(function Select(
  { label, labelClassName, error, tone = "light", className = "", containerClassName = "", children, ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses({ className: labelClassName })}>{label}</label>}
      <select ref={ref} className={controlClasses({ error, className, tone })} {...props}>
        {children}
      </select>
      {error && <p className={errorTextClasses}>{error}</p>}
    </div>
  );
});
