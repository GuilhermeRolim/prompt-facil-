(function () {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    const loadingArea = document.getElementById('loadingArea');
    const formArea = document.getElementById('formArea');
    const actionArea = document.getElementById('actionArea');
    const statusIcon = document.getElementById('statusIcon');
    const statusMessage = document.getElementById('statusMessage');

    function showStatus(icon, message, type) {
        loadingArea.style.display = 'block';
        formArea.style.display = 'none';
        statusIcon.textContent = icon;
        statusMessage.textContent = message;
        statusMessage.className = type ? 'is-' + type : '';
    }

    function showDone(icon, message, type) {
        showStatus(icon, message, type);
        actionArea.style.display = 'block';
    }

    if (!mode || !oobCode) {
        showDone('⚠️', 'Link inválido ou incompleto. Volte ao app e tente novamente.', 'error');
        return;
    }

    if (mode === 'verifyEmail') {
        auth.applyActionCode(oobCode)
            .then(() => {
                showDone('✅', 'Seu email foi confirmado com sucesso! Você já pode usar sua conta normalmente.', 'success');
            })
            .catch(() => {
                showDone('⚠️', 'Esse link de confirmação é inválido ou já expirou. Peça um novo dentro do app, na tela principal.', 'error');
            });

    } else if (mode === 'resetPassword') {
        auth.verifyPasswordResetCode(oobCode)
            .then(() => {
                loadingArea.style.display = 'none';
                formArea.style.display = 'block';
            })
            .catch(() => {
                showDone('⚠️', 'Esse link de redefinição de senha é inválido ou já expirou. Peça um novo na tela de login.', 'error');
            });

    } else if (mode === 'recoverEmail') {
        auth.checkActionCode(oobCode)
            .then(() => auth.applyActionCode(oobCode))
            .then(() => {
                showDone('✅', 'Alteração de email revertida com sucesso.', 'success');
            })
            .catch(() => {
                showDone('⚠️', 'Esse link é inválido ou já expirou.', 'error');
            });

    } else {
        showDone('⚠️', 'Esse tipo de link não é reconhecido pelo app.', 'error');
    }

    window.submitNewPassword = function () {
        const newPassword = document.getElementById('newPassword').value;
        const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
        const formMessage = document.getElementById('formMessage');
        const submitBtn = document.getElementById('resetSubmitBtn');

        formMessage.style.color = 'var(--text-secondary)';

        if (!newPassword || !newPasswordConfirm) {
            formMessage.textContent = 'Preencha os dois campos de senha.';
            formMessage.style.color = 'var(--danger)';
            return;
        }
        if (newPassword.length < 6) {
            formMessage.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
            formMessage.style.color = 'var(--danger)';
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            formMessage.textContent = 'As senhas não conferem.';
            formMessage.style.color = 'var(--danger)';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';

        auth.confirmPasswordReset(oobCode, newPassword)
            .then(() => {
                showDone('✅', 'Senha redefinida com sucesso! Já pode entrar com a nova senha.', 'success');
            })
            .catch(() => {
                formMessage.textContent = 'Não foi possível salvar a nova senha. O link pode ter expirado — peça um novo.';
                formMessage.style.color = 'var(--danger)';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Redefinir senha';
            });
    };
})();
