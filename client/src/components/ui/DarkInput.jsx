// Same Input/Select/Textarea, defaulted to the dark tone (white typed text, white placeholder,
// bg-white/5 field) — import these instead of ui/Input, ui/Select, ui/Textarea on any page that
// lives on the app's dark surface (Menu, Tables, Orders, Order Detail, Alerts, Team). Login and
// Landing keep importing the light originals directly, since they still sit on a white card.
import { Input as BaseInput } from "./Input";
import { Select as BaseSelect } from "./Select";
import { Textarea as BaseTextarea } from "./Textarea";

export function Input(props) {
  return <BaseInput tone="dark" {...props} />;
}

export function Select(props) {
  return <BaseSelect tone="dark" {...props} />;
}

export function Textarea(props) {
  return <BaseTextarea tone="dark" {...props} />;
}
