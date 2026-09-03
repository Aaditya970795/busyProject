import { forwardRef } from "react";
import { controlClasses, labelClasses, errorTextClasses } from "./fieldClasses";

export const Textarea = forwardRef(function Textarea(
  { label, labelClassName, error, tone = "light", className = "", containerClassName = "", ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses({ className: labelClassName })}>{label}</label>}
      <textarea ref={ref} className={controlClasses({ error, className, tone })} {...props} />
      {error && <p className={errorTextClasses}>{error}</p>}
    </div>
  );
});
