const api = axios.create({
    // Usa o mesmo "endereço" da página (localhost ou 127.0.0.1). Os dois são sites
    // diferentes para o navegador, e o cookie de login não viajaria entre eles.
    baseURL: "https://prontuario-web-back.onrender.com",
    // baseURL: `http://${window.location.hostname}:3000/api`,
    withCredentials: true, // envia o cookie de sessão junto com cada chamada
})

// Páginas dentro de "html/" chegam ao login com "login.html"; o index.html, com "html/login.html"
const caminhoLogin = window.location.pathname.includes("/html/") ? "login.html" : "html/login.html"
const paginaDeAcesso = /(login|cadastro)\.html$/.test(window.location.pathname)

// Se o servidor responder "não está logado" (401), manda para o login
api.interceptors.response.use(
    (resposta) => resposta,
    (erro) => {
        if (erro.response?.status === 401 && !paginaDeAcesso) {
            window.location.href = caminhoLogin
        }
        return Promise.reject(erro)
    }
)