/* auth.js — страница входа */
(function() {
  Theme.init();
  document.getElementById('themeToggle').addEventListener('click', function() { Theme.toggle(); });
  document.getElementById('roleTrainer').innerHTML = Icons.svg('user', 18) + ' Я тренер';
  document.getElementById('roleClient').innerHTML = Icons.svg('dumbbell', 18) + ' Я клиент';
  document.getElementById('loginBtn').innerHTML = Icons.svg('logout', 18) + ' Войти';

  var session = Token.getSession();
  if (session && Token.get()) {
    location.href = session.role === 'trainer' ? 'trainer-dashboard.html' : 'client-dashboard.html';
    return;
  }

  var role = 'trainer';
  document.querySelectorAll('.role-switch button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.role-switch button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      role = btn.dataset.role;
      document.getElementById('username').placeholder = role === 'trainer' ? 'Введите логин' : 'Введите ФИО или телефон';
    });
  });

  var form = document.getElementById('loginForm');
  var errorEl = document.getElementById('errorMsg');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errorEl.classList.remove('show');
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    var btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Вход...';

    API.login(username, password).then(function(data) {
      if (data.role !== role) {
        throw new Error(role === 'trainer' ? 'Это аккаунт клиента. Выберите «Я клиент».' : 'Это аккаунт тренера. Выберите «Я тренер».');
      }
      Token.set(data.access_token);
      Token.setSession(data);
      toast('Добро пожаловать!', data.full_name || '', 'success');
      setTimeout(function() {
        location.href = data.role === 'trainer' ? 'trainer-dashboard.html' : 'client-dashboard.html';
      }, 600);
    }).catch(function(err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = Icons.svg('logout', 18) + ' Войти';
    });
  });
})();
