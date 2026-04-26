'use client'

export default function LoginScreen() {
  return (
    <div id="login-screen" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Авторизация" data-lang-aria="login_aria" data-modal-static="true">
      <div className="login-box">
        <h1 className="brand-text-fixed" data-brand-text="">SmartNotes</h1>
        <p className="subtext" data-lang="login">Вход в систему</p>
        <div className="auth-panel-switch" role="tablist" aria-label="Email authentication" data-lang-aria="email_authentication" inert={true} aria-busy="true">
          <button type="button" className="btn-auth-tab active" id="email-signin-tab" data-auth-mode="signin" data-lang="email_signin_tab">Вход</button>
          <button type="button" className="btn-auth-tab" id="email-signup-tab" data-auth-mode="signup" data-lang="email_signup_tab">Регистрация</button>
        </div>
        <form id="email-signin-form" className="auth-form" method="post" action="#" noValidate inert={true} aria-busy="true">
          <label className="auth-field" htmlFor="email-signin-input">
            <span data-lang="email_label">Email</span>
            <input id="email-signin-input" type="email" autoComplete="email" required />
          </label>
          <label className="auth-field" htmlFor="password-signin-input">
            <span data-lang="password_label">Пароль</span>
            <div className="auth-password-row">
              <input id="password-signin-input" type="password" autoComplete="current-password" required />
              <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signin-input" data-lang="show_password">Показать</button>
            </div>
          </label>
          <button type="button" className="btn-auth-link" data-auth-action="forgot-password" data-lang="forgot_password">Забыли пароль?</button>
          <button type="submit" className="btn-auth primary" data-lang="email_signin_button">Войти по email</button>
        </form>
        <form id="email-signup-form" className="auth-form hidden" method="post" action="#" noValidate inert={true} aria-busy="true">
          <label className="auth-field" htmlFor="email-signup-input">
            <span data-lang="email_label">Email</span>
            <input id="email-signup-input" type="email" autoComplete="email" required />
          </label>
          <label className="auth-field" htmlFor="password-signup-input">
            <span data-lang="password_label">Пароль</span>
            <div className="auth-password-row">
              <input id="password-signup-input" type="password" autoComplete="new-password" required />
              <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signup-input" data-lang="show_password">Показать</button>
            </div>
          </label>
          <label className="auth-field" htmlFor="password-signup-repeat-input">
            <span data-lang="password_repeat_label">Повторите пароль</span>
            <div className="auth-password-row">
              <input id="password-signup-repeat-input" type="password" autoComplete="new-password" required />
              <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signup-repeat-input" data-lang="show_password">Показать</button>
            </div>
          </label>
          <button type="submit" className="btn-auth primary" data-lang="email_signup_button">Зарегистрироваться</button>
        </form>
        <div id="email-auth-feedback" className="auth-feedback is-info" role="status" aria-live="polite">Подключение к сервису входа...</div>
        <div className="auth-buttons-group">
          <button type="button" className="btn-auth google" data-action="login">
            <img src="css/Glogo.svg" alt="" width="20" height="20" />
            <span data-lang="login_google">Войти через Google</span>
          </button>
        </div>
      </div>
    </div>
  )
}
