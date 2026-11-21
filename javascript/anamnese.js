const form = document.getElementById("form-paciente")
const botao = document.getElementById("botao-salvar")
const titulo = document.getElementById("titulo-pagina")
const campoNascimento = document.getElementById("dataNascimento")
const textoIdade = document.getElementById("idade-calculada")
const blocoResponsavel = document.getElementById("bloco-responsavel")

// Se a URL for anamnese.html?id=123, estamos editando o paciente 123
const idEdicao = new URLSearchParams(window.location.search).get("id")

// Lê o valor de um campo pelo atributo name, já sem espaços nas pontas
const valor = (nome) => form.elements[nome].value.trim()

// Escreve num campo pelo atributo name (valor vazio vira texto vazio)
const definir = (nome, conteudo) => {
    form.elements[nome].value = conteudo || ""
}

// "1990-05-10T00:00:00.000Z" -> "1990-05-10" (formato do input date)
const dataParaInput = (dataIso) => (dataIso ? dataIso.slice(0, 10) : "")

// Recebe "1990-05-10" (formato do input date) e devolve a idade em anos
function idadeEmAnos(dataTexto) {
    if (!dataTexto) return null

    const [ano, mes, dia] = dataTexto.split("-").map(Number)
    const hoje = new Date()

    let idade = hoje.getFullYear() - ano
    const aindaNaoFezAniversario =
        hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)

    if (aindaNaoFezAniversario) idade--
    return idade
}

// Mostra a idade e, se for menor, abre o bloco do responsável
function atualizarIdade() {
    const idade = idadeEmAnos(campoNascimento.value)

    if (idade === null) {
        textoIdade.textContent = ""
    } else if (idade < 0) {
        textoIdade.textContent = "Data no futuro"
    } else {
        textoIdade.textContent = `${idade} anos`
    }

    blocoResponsavel.hidden = !(idade !== null && idade >= 0 && idade < 18)
}

campoNascimento.addEventListener("change", atualizarIdade)

// Busca de endereço pelo CEP (serviço público ViaCEP)
const campoCep = document.getElementById("cep")
const ajudaCep = document.getElementById("ajuda-cep")
let buscaCepEmAndamento = null

campoCep.addEventListener("input", async () => {
    const cep = apenasDigitos(campoCep.value)

    // Se o CEP mudou antes da resposta chegar, cancela a busca anterior
    if (buscaCepEmAndamento) buscaCepEmAndamento.abort()

    if (cep.length !== 8) {
        ajudaCep.textContent = ""
        return
    }

    buscaCepEmAndamento = new AbortController()
    ajudaCep.textContent = "Buscando endereço..."

    try {
        // "axios" direto (e não "api"), porque este endereço é de outro site
        const resposta = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, {
            signal: buscaCepEmAndamento.signal,
            timeout: 5000,
        })
        const dados = resposta.data

        if (dados.erro) {
            ajudaCep.textContent = "CEP não encontrado. Preencha o endereço manualmente."
            return
        }

        definir("logradouro", dados.logradouro)
        definir("bairro", dados.bairro)
        definir("cidade", dados.localidade)
        definir("uf", dados.uf)
        ajudaCep.textContent = "Endereço preenchido. Confira e informe o número."

        // Leva o cursor para o próximo campo que a pessoa precisa preencher
        const proximo = dados.logradouro ? form.elements.numero : form.elements.logradouro
        proximo.focus()
    } catch (erro) {
        if (axios.isCancel(erro)) return // foi cancelada por uma busca mais nova
        ajudaCep.textContent = "Não foi possível buscar o CEP. Preencha o endereço manualmente."
    }
})

// Modo edição: busca o paciente e preenche o formulário
async function carregarParaEdicao() {
    try {
        const resposta = await api.get(`/pacientes/${encodeURIComponent(idEdicao)}`)
        const p = resposta.data

        // Pacientes antigos podem não ter estes grupos
        const e = p.endereco || {}
        const r = p.responsavel || {}
        const em = p.emergencia || {}
        const c = p.consentimento || {}

        definir("nome", p.nome)
        definir("nomeSocial", p.nomeSocial)
        definir("dataNascimento", dataParaInput(p.dataNascimento))
        definir("cpf", p.cpf)
        definir("genero", p.genero)
        definir("estadoCivil", p.estadoCivil)
        definir("escolaridade", p.escolaridade)
        definir("profissao", p.profissao)

        definir("telefone", p.telefone)
        definir("email", p.email)
        definir("cep", e.cep)
        definir("logradouro", e.logradouro)
        definir("numero", e.numero)
        definir("complemento", e.complemento)
        definir("bairro", e.bairro)
        definir("cidade", e.cidade)
        definir("uf", e.uf)

        definir("responsavelNome", r.nome)
        definir("responsavelParentesco", r.parentesco)
        definir("responsavelCpf", r.cpf)
        definir("responsavelTelefone", r.telefone)

        definir("emergenciaNome", em.nome)
        definir("emergenciaParentesco", em.parentesco)
        definir("emergenciaTelefone", em.telefone)

        definir("queixa", p.queixa)
        definir("encaminhamento", p.encaminhamento)
        definir("dataInicio", dataParaInput(p.dataInicio))
        definir("medicacao", p.medicacao)
        definir("tratamentosAnteriores", p.tratamentosAnteriores)
        definir("historicoFamiliar", p.historicoFamiliar)
        definir("observacoes", p.observacoes)

        form.elements.consentimento.checked = c.aceito === true
        definir("dataConsentimento", dataParaInput(c.data))

        aplicarMascaras() // formata CPF, telefone e CEP de pacientes salvos sem máscara
        atualizarIdade() // mostra a idade e abre o bloco do responsável, se for menor

        titulo.textContent = "Editar paciente"
        document.title = "Editar paciente"
        botao.textContent = "Salvar alterações"
    } catch (erro) {
        console.error("Erro ao carregar paciente:", erro)
        toastNaProximaPagina("Paciente não encontrado.", "erro")
        window.location.href = "pacientes.html"
    }
}

if (idEdicao) carregarParaEdicao()

form.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    if (!form.elements.consentimento.checked) {
        mostrarToast("Registre o consentimento do paciente para continuar.", "erro")
        return
    }

    const dados = {
        nome: valor("nome"),
        nomeSocial: valor("nomeSocial"),
        dataNascimento: valor("dataNascimento"),
        cpf: valor("cpf"),
        genero: valor("genero"),
        estadoCivil: valor("estadoCivil"),
        escolaridade: valor("escolaridade"),
        profissao: valor("profissao"),

        telefone: valor("telefone"),
        email: valor("email"),
        endereco: {
            cep: valor("cep"),
            logradouro: valor("logradouro"),
            numero: valor("numero"),
            complemento: valor("complemento"),
            bairro: valor("bairro"),
            cidade: valor("cidade"),
            uf: valor("uf"),
        },

        responsavel: {
            nome: valor("responsavelNome"),
            parentesco: valor("responsavelParentesco"),
            cpf: valor("responsavelCpf"),
            telefone: valor("responsavelTelefone"),
        },
        emergencia: {
            nome: valor("emergenciaNome"),
            parentesco: valor("emergenciaParentesco"),
            telefone: valor("emergenciaTelefone"),
        },

        queixa: valor("queixa"),
        encaminhamento: valor("encaminhamento"),
        dataInicio: valor("dataInicio"),
        medicacao: valor("medicacao"),
        tratamentosAnteriores: valor("tratamentosAnteriores"),
        historicoFamiliar: valor("historicoFamiliar"),
        observacoes: valor("observacoes"),

        consentimento: {
            aceito: form.elements.consentimento.checked,
            data: valor("dataConsentimento"),
        },
    }

    botao.disabled = true

    try {
        if (idEdicao) {
            await api.put(`/pacientes/${encodeURIComponent(idEdicao)}`, dados)
            toastNaProximaPagina("Alterações salvas!", "sucesso")
            window.location.href = "pacientes.html"
            return
        }

        await api.post("/pacientes", dados)
        mostrarToast("Paciente salvo!", "sucesso")
        form.reset()
        ajudaCep.textContent = ""
        textoIdade.textContent = ""
        blocoResponsavel.hidden = true
    } catch (erro) {
        if (erro.response) {
            mostrarToast(mensagemDoErro(erro, "Não foi possível salvar."), "erro")
        } else {
            mostrarToast(mensagemDoErro(erro, "Não foi possível salvar."), "erro")
        }
    } finally {
        botao.disabled = false
    }
})