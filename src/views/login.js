import { isFirebaseMode, loginLocal, loginFirebase } from '../auth.js';
import { toast } from '../ui.js';

export function renderLogin(root) {
  if (isFirebaseMode()) {
    root.innerHTML = `
      <div class="login">
        <h1>📱 Shop Manager</h1>
        <label class="field"><span>Email</span>
          <input id="email" type="email" class="input" autocomplete="username" /></label>
        <label class="field"><span>Password</span>
          <input id="pass" type="password" class="input" autocomplete="current-password" /></label>
        <button id="go" class="btn-primary btn-big">Log in</button>
      </div>`;
    const go = async () => {
      try {
        await loginFirebase(
          root.querySelector('#email').value.trim(),
          root.querySelector('#pass').value
        );
      } catch {
        toast('Login failed — check email and password', false);
      }
    };
    root.querySelector('#go').addEventListener('click', go);
    root.querySelector('#pass').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    return;
  }

  root.innerHTML = `
    <div class="login">
      <h1>📱 Shop Manager</h1>
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
