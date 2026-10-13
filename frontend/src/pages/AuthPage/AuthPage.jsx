import { useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { AUTH_LIMITS, validateAuthForm } from "../../utils/validation";
import styles from "./AuthPage.module.css";

const EMPTY_FORM = { name: "", email: "", password: "" };

// One labelled input with its error message underneath.
function Field({ id, label, error, hint, inputRef, children, ...inputProps }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          ref={inputRef}
          className={error ? styles.invalid : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        {children}
      </div>
      {error ? (
        <small id={`${id}-error`} className={styles.fieldError}>
          {error}
        </small>
      ) : (
        hint && (
          <small id={`${id}-hint`} className={styles.hint}>
            {hint}
          </small>
        )
      )}
    </div>
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = { name: useRef(null), email: useRef(null), password: useRef(null) };

  const isRegister = mode === "register";

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    // Clear the message for a field as soon as the user edits it.
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setFieldErrors({});
    setFormError("");
  };

  const focusFirstError = (errors) => {
    const first = ["name", "email", "password"].find((field) => errors[field]);
    inputRefs[first]?.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const errors = validateAuthForm(form, mode);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstError(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (error) {
      if (Object.keys(error.fieldErrors ?? {}).length) {
        setFieldErrors(error.fieldErrors);
        focusFirstError(error.fieldErrors);
      } else {
        setFormError(error.message);
      }
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          <Sparkles size={26} />
        </div>
        <h1 className={styles.title}>{isRegister ? "Create an account" : "Welcome back"}</h1>
        <p className={styles.subtitle}>
          {isRegister ? "Sign up to save your chats." : "Log in to continue your chats."}
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <Field
              id="name"
              label="Name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={update("name")}
              maxLength={AUTH_LIMITS.NAME_MAX}
              error={fieldErrors.name}
              inputRef={inputRefs.name}
              autoFocus
            />
          )}

          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            error={fieldErrors.email}
            inputRef={inputRefs.email}
            autoFocus={!isRegister}
          />

          <Field
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={form.password}
            onChange={update("password")}
            maxLength={AUTH_LIMITS.PASSWORD_MAX}
            error={fieldErrors.password}
            hint={isRegister ? `At least ${AUTH_LIMITS.PASSWORD_MIN} characters.` : undefined}
            inputRef={inputRefs.password}
          >
            <button
              type="button"
              className={styles.eye}
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </Field>

          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle size={18} className="spin" />}
            {isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p className={styles.switch}>
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={switchMode}>
            {isRegister ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </main>
  );
}
