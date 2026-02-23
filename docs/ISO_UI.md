# ISO-aligned UI and interaction (informational)

This document describes how the CLIRDEC:PRESENCE UI applies **ISO 9241** (ergonomics of human-system interaction) and related usability practices for layout, spacing, login, and logout. This is **informational** and does not constitute formal certification.

---

## Standards referenced

| Standard | Scope |
|----------|--------|
| **ISO 9241-110** | Dialogue principles: suitability for the task, self-descriptiveness, controllability, conformity with user expectations, error tolerance |
| **ISO 9241-143** | Forms: guidance on form design and layout |
| **ISO 9241-171** | Software accessibility (including minimum target sizes) |

---

## Spacing and layout

- **8px base grid:** All padding and margins use a consistent scale derived from an 8px base:
  - `--space-1`: 8px  
  - `--space-2`: 16px  
  - `--space-3`: 24px  
  - `--space-4`: 32px  
  - `--space-5`: 40px  
  - `--space-6`: 48px  

- **Tailwind:** The same scale is exposed as `iso-1` … `iso-6` and `touch` (min height) in the theme (e.g. `p-iso-3`, `gap-iso-2`, `min-h-touch`).

- **Minimum touch target:** Interactive controls use at least **44px** height (`--touch-min` / `min-h-touch`) where possible, in line with ISO 9241-171 and WCAG 2.5.5.

---

## Login (Sign in)

- **Self-descriptiveness:** The login screen has a clear title (CLIRDEC:PRESENCE). Each input has a visible **label** (“Email address”, “Password”) and a placeholder; the primary action is labeled “Sign in”.
- **Controllability:** Form submission is explicit (button). Focus order is: email → password → Sign in → Privacy notice link. Initial focus is on the email field.
- **Error tolerance:** On failure, an error message is shown with `role="alert"` and `id="login-error"` so assistive technologies announce it. Errors are not solely indicated by color.
- **Accessibility:** Inputs use `aria-required`, `aria-invalid` when relevant, and `aria-labelledby` on the form. The submit button has `aria-busy` during loading and a clear `aria-label`.

---

## Logout

- **Conformity with user expectations:** “Log out” is always in the same place: the **sidebar footer**, below the user block and the Privacy link.
- **Controllability:** One click logs the user out and ends the session; the user is then redirected to the login page (no extra confirmation step, as logging out is reversible by signing in again).
- **Accessibility:** The logout control is a **button** (not a link), with `aria-label="Log out and end session"`. It meets the minimum touch target (44px height) and is keyboard operable.

---

## Summary

- **Spacing:** 8px grid and consistent use of `--space-*` / `iso-*` and `min-h-touch`.
- **Login:** Labeled inputs, logical focus order, alert for errors, ARIA where appropriate.
- **Logout:** Fixed location in sidebar, single action, clear label, minimum touch target.

Formal ISO certification would require an accredited audit; this describes design choices made to align with the above standards.
