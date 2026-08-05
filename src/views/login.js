import {
  isFirebaseMode,
  loginLocal,
  loginFirebase,
  signupFirebase,
  joinFirebase,
} from '../auth.js';
import { toast } from '../ui.js';

export function renderLogin(root) {
  if (isFirebaseMode()) {
    let mode = 'login'; // 'login' | 'signup' | 'join'
    const val = (id) => root.querySelector('#' + id)?.value.trim() || '';

    function draw() {
      if (mode === 'signup') {
        root.innerHTML = `
          <div class="login">
            <h1>🛍️ Create your shop</h1>
            <p class="muted">A shop ID is generated automatically — no setup needed.</p>
            <label class="field"><span>Shop name</span>
              <input id="shop" class="input" placeholder="e.g. Kampala Phone Point" /></label>
            <label class="field"><span>Your name</span>
              <input id="name" class="input" autocomplete="name" /></label>
            <label class="field"><span>Email</span>
              <input id="email" type="email" class="input" autocomplete="username" /></label>
            <label class="field"><span>Password</span>
              <input id="pass" type="password" class="input" autocomplete="new-password" placeholder="at least 6 characters" /></label>
            <button id="go" class="btn-primary btn-big">Create shop</button>
            <p class="auth-switch">Already have an account?
              <button data-mode="login">Log in</button></p>
          </div>`;
      } else if (mode === 'join') {
        root.innerHTML = `
          <div class="login">
            <h1>🧑🏾‍💼 Join a shop</h1>
            <p class="muted">Ask the owner for the shop code, then create your staff account.</p>
            <label class="field"><span>Shop code</span>
              <input id="shopId" class="input" placeholder="shop_..." autocapitalize="off" /></label>
            <label class="field"><span>Your name</span>
              <input id="name" class="input" autocomplete="name" /></label>
            <label class="field"><span>Email</span>
              <input id="email" type="email" class="input" autocomplete="username" /></label>
            <label class="field"><span>Password</span>
              <input id="pass" type="password" class="input" autocomplete="new-password" placeholder="at least 6 characters" /></label>
            <button id="go" class="btn-primary btn-big">Join shop</button>
            <p class="auth-switch">Already have an account?
              <button data-mode="login">Log in</button></p>
          </div>`;
      } else {
        root.innerHTML = `
          <div class="login">
            <h1>🛍️ Shop Manager</h1>
            <label class="field"><span>Email</span>
              <input id="email" type="email" class="input" autocomplete="username" /></label>
            <label class="field"><span>Password</span>
              <input id="pass" type="password" class="input" autocomplete="current-password" /></label>
            <button id="go" class="btn-primary btn-big">Log in</button>
            <p class="auth-switch">New here?
              <button data-mode="signup">Create a shop</button>
              · <button data-mode="join">Join with a code</button></p>
          </div>`;
      }

      root.querySelectorAll('.auth-switch button').forEach((b) =>
        b.addEventListener('click', () => {
          mode = b.dataset.mode;
          draw();
        })
      );

      const go = async () => {
        const btn = root.querySelector('#go');
        btn.disabled = true;
        try {
          if (mode === 'signup') {
            const shopName = val('shop');
            const ownerName = val('name');
            const email = val('email');
            const pass = root.querySelector('#pass').value;
            if (!shopName || !ownerName || !email || pass.length < 6)
              throw new Error('Fill every field (password 6+ characters)');
            await signupFirebase({ shopName, ownerName, email, pass });
          } else if (mode === 'join') {
            const shopId = val('shopId');
            const staffName = val('name');
            const email = val('email');
            const pass = root.querySelector('#pass').value;
            if (!shopId || !staffName || !email || pass.length < 6)
              throw new Error('Fill every field (password 6+ characters)');
            await joinFirebase({ shopId, staffName, email, pass });
          } else {
            await loginFirebase(val('email'), root.querySelector('#pass').value);
          }
        } catch (err) {
          btn.disabled = false;
          const msg =
            mode === 'login'
              ? 'Login failed — check email and password'
              : err?.message?.startsWith('Fill')
                ? err.message
                : friendly(err);
          toast(msg, false);
        }
      };

      root.querySelector('#go').addEventListener('click', go);
      root.querySelector('#pass')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') go();
      });
    }

    function friendly(err) {
      const c = err?.code || '';
      if (c.includes('email-already-in-use')) return 'That email already has an account — log in instead.';
      if (c.includes('invalid-email')) return 'That email address looks invalid.';
      if (c.includes('weak-password')) return 'Password is too weak — use at least 6 characters.';
      if (c.includes('permission-denied')) return 'Blocked by security rules — deploy them with npm run deploy:rules.';
      return 'Something went wrong — please try again.';
    }

    draw();
    return;
  }

  root.innerHTML = `
    <div class="login">
      <h1>🛍️ Shop Manager</h1>
      <p class="muted">Demo mode — everything is saved on this phone only.<br/>
      PINs: Owner <b>1234</b> · Staff <b>1111</b></p>
      <div class="role-row">
        <button class="role-btn" data-role="owner">👩🏾‍💼 Owner</button>
        <button class="role-btn" data-role="staff">🧑🏾 Staff</button>
      </div>
      <div id="pin-box" class="hidden">
        <label class="field"><span>PIN</span>
          <input id="pin" type="password" inputmode="numeric" class="input" /></label>
        <button id="go" class="btn-primary btn-big">Enter shop</button>
      </div>
    </div>`;

  let role = null;
  const go = () => {
    try {
      loginLocal(role, root.querySelector('#pin').value);
    } catch {
      toast('Wrong PIN', false);
    }
  };
  root.querySelectorAll('.role-btn').forEach((b) =>
    b.addEventListener('click', () => {
      role = b.dataset.role;
      root.querySelectorAll('.role-btn').forEach((x) => x.classList.toggle('active', x === b));
      root.querySelector('#pin-box').classList.remove('hidden');
      root.querySelector('#pin').focus();
    })
  );
  root.querySelector('#go').addEventListener('click', go);
  root.querySelector('#pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
}
