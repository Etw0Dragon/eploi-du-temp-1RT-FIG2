// Les devoirs utilisent une session Supabase anonyme : aucun compte n'est demandé.
const todoGroup = "fi1g2";
const todoDraftKey = "edt-homework-draft-" + todoGroup;
const todoNameKey = "edt-homework-name";
const todo = {
  client: null,
  user: null,
  tasks: [],
  doneIds: new Set(),
  filter: "open",
  archives: false,
  started: false
};

const todoElement = (selector) => document.querySelector(selector);
const todoView = todoElement("#todo-view");
const agendaView = todoElement("#agenda-view");
const todoList = todoElement("#todo-list");
const todoStatus = todoElement("#todo-status");
const todoDialog = todoElement("#homework-dialog");
const todoForm = todoElement("#homework-form");

function escapeTodo(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

function localDay(date = new Date()) {
  const value = new Date(date);
  return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
}

function addLocalDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function dueLabel(task) {
  const date = new Date(task.due_date + "T12:00:00");
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date);
  return task.due_time ? day + " · " + task.due_time.slice(0, 5) : day;
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function setTodoStatus(message, type = "") {
  todoStatus.textContent = message;
  todoStatus.className = "small mt-3 mb-2 " + (type ? "text-" + type : "text-body-secondary");
}

function setFormStatus(message, type = "") {
  const target = todoElement("#homework-form-status");
  target.textContent = message;
  target.className = "small mb-3 " + (type ? "text-" + type : "");
}

function updateNavigation() {
  const visible = location.hash === "#devoirs";
  agendaView.hidden = visible;
  todoView.hidden = !visible;
  todoElement("#agenda-tab").classList.toggle("active", !visible);
  todoElement("#todo-tab").classList.toggle("active", visible);
  todoElement("#group-select").hidden = visible;
  todoElement(".agenda-actions").hidden = visible;
  todoElement("#refresh-button").hidden = visible;
  if (visible) startTodo();
}

function configured() {
  const config = window.EDT_SUPABASE;
  return config && config.url && config.anonKey && window.supabase;
}

async function ensureAnonymousUser() {
  const { data: current } = await todo.client.auth.getUser();
  if (current.user) {
    todo.user = current.user;
    return;
  }
  const { data, error } = await todo.client.auth.signInAnonymously();
  if (error) throw error;
  todo.user = data.user;
}

async function startTodo() {
  if (todo.started) return;
  todo.started = true;
  if (!configured()) {
    setTodoStatus("Les devoirs seront disponibles après la configuration Supabase.", "warning");
    return;
  }
  try {
    const config = window.EDT_SUPABASE;
    todo.client = window.supabase.createClient(config.url, config.anonKey);
    await ensureAnonymousUser();
    restoreDraft();
    await loadTodos();
    subscribeToTodos();
  } catch (error) {
    setTodoStatus("Impossible de se connecter aux devoirs : " + error.message, "danger");
  }
}

async function loadTodos() {
  setTodoStatus("Mise à jour…");
  const tasksRequest = todo.client.from("homeworks").select("*").eq("group_id", todoGroup).order("due_date").order("due_time", { nullsFirst: false });
  const progressRequest = todo.client.from("homework_progress").select("homework_id").eq("user_id", todo.user.id);
  const [{ data: tasks, error: tasksError }, { data: progress, error: progressError }] = await Promise.all([tasksRequest, progressRequest]);
  if (tasksError || progressError) throw tasksError || progressError;
  todo.tasks = tasks || [];
  todo.doneIds = new Set((progress || []).map((row) => row.homework_id));
  setTodoStatus(todo.tasks.length ? "Synchronisé en direct" : "Aucun devoir pour le moment.");
  renderTodos();
}

function isArchived(task) {
  return task.due_date < localDay(addLocalDays(new Date(), -30));
}

function isLate(task) {
  return task.due_date < localDay() && !todo.doneIds.has(task.id) && !isArchived(task);
}

function visibleTasks() {
  return todo.tasks.filter((task) => {
    const done = todo.doneIds.has(task.id);
    if (todo.archives) return isArchived(task);
    if (isArchived(task)) return false;
    return todo.filter === "all" || (todo.filter === "done" ? done : !done);
  });
}

function taskCard(task) {
  const done = todo.doneIds.has(task.id);
  const own = task.author_id === todo.user.id;
  const link = safeLink(task.link);
  const description = task.description ? '<p class="homework-description">' + escapeTodo(task.description) + "</p>" : "";
  const resource = link ? '<p class="mb-0 mt-2"><a class="homework-link" href="' + escapeTodo(link) + '" target="_blank" rel="noreferrer">Ouvrir la ressource ↗</a></p>' : "";
  const actions = own ? '<div class="homework-actions"><button class="btn btn-sm btn-light" type="button" data-action="edit" data-id="' + escapeTodo(task.id) + '">Modifier</button><button class="btn btn-sm btn-light text-danger" type="button" data-action="delete" data-id="' + escapeTodo(task.id) + '" aria-label="Supprimer ce devoir">×</button></div>' : "";
  return '<article class="homework-card' + (done ? " is-done" : "") + (isLate(task) ? " is-late" : "") + '">' +
    '<input class="homework-check" type="checkbox" data-action="toggle" data-id="' + escapeTodo(task.id) + '" ' + (done ? "checked" : "") + ' aria-label="Marquer « ' + escapeTodo(task.title) + ' » comme fait" />' +
    '<div class="homework-main"><p class="homework-subject mb-0">' + escapeTodo(task.subject) + '</p><h2 class="homework-title">' + escapeTodo(task.title) + '</h2>' +
    '<p class="homework-meta mb-0">À rendre ' + escapeTodo(dueLabel(task)) + ' · ajouté par ' + escapeTodo(task.author_name) + '</p>' + description + resource + '</div>' + actions + '</article>';
}

function renderTodos() {
  const tasks = visibleTasks();
  if (!tasks.length) {
    todoList.innerHTML = '<p class="empty-todos">' + (todo.archives ? "Aucune archive." : "Rien à faire ici. Ajoute le premier devoir de la promo.") + "</p>";
    return;
  }
  const late = tasks.filter(isLate);
  const other = tasks.filter((task) => !isLate(task));
  const group = (title, rows) => rows.length ? '<section class="todo-section"><h2 class="todo-section-title">' + title + "</h2>" + rows.map(taskCard).join("") + "</section>" : "";
  todoList.innerHTML = group("En retard", late) + group(todo.archives ? "Archives" : "Devoirs", other);
}

function saveDraft() {
  if (todoForm.dataset.editId) return;
  const draft = Object.fromEntries(new FormData(todoForm));
  localStorage.setItem(todoDraftKey, JSON.stringify(draft));
}

function restoreDraft() {
  todoElement("#homework-author").value = localStorage.getItem(todoNameKey) || "";
  todoElement("#homework-date").value = localDay(addLocalDays(new Date(), 1));
  try {
    const draft = JSON.parse(localStorage.getItem(todoDraftKey) || "null");
    if (!draft) return;
    for (const [name, value] of Object.entries(draft)) {
      const input = todoForm.elements.namedItem(name);
      if (input && typeof value === "string") input.value = value;
    }
    setTodoStatus("Brouillon restauré : tu peux reprendre là où tu t’étais arrêté.", "warning");
  } catch {
    localStorage.removeItem(todoDraftKey);
  }
}

function openDialog(task) {
  todoForm.reset();
  todoForm.dataset.editId = task?.id || "";
  todoElement("#homework-dialog-title").textContent = task ? "Modifier le devoir" : "À ajouter";
  todoElement("#save-homework-button").textContent = task ? "Enregistrer" : "Publier";
  const author = todoElement("#homework-author");
  author.value = task ? task.author_name : (localStorage.getItem(todoNameKey) || "");
  author.disabled = Boolean(task);
  if (task) {
    todoElement("#homework-subject").value = task.subject;
    todoElement("#homework-title").value = task.title;
    todoElement("#homework-date").value = task.due_date;
    todoElement("#homework-time").value = task.due_time || "";
    todoElement("#homework-description").value = task.description || "";
    todoElement("#homework-link").value = task.link || "";
  } else {
    todoElement("#homework-date").value = localDay(addLocalDays(new Date(), 1));
    restoreDraft();
  }
  setFormStatus("");
  todoDialog.showModal();
  setTimeout(() => (task ? todoElement("#homework-title") : author).focus(), 0);
}

function closeDialog() {
  todoDialog.close();
}

async function saveHomework(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(todoForm));
  const editing = todoForm.dataset.editId;
  const payload = {
    subject: values.subject.trim(),
    title: values.title.trim(),
    due_date: values.dueDate,
    due_time: values.dueTime || null,
    description: values.description.trim() || null,
    link: values.link.trim() || null
  };
  const button = todoElement("#save-homework-button");
  button.disabled = true;
  setFormStatus("Enregistrement…");
  try {
    if (editing) {
      const { error } = await todo.client.from("homeworks").update(payload).eq("id", editing);
      if (error) throw error;
    } else {
      localStorage.setItem(todoNameKey, values.author.trim());
      const { error } = await todo.client.rpc("create_homework", {
        p_group_id: todoGroup,
        p_author_name: values.author.trim(),
        p_subject: payload.subject,
        p_title: payload.title,
        p_due_date: payload.due_date,
        p_due_time: payload.due_time,
        p_description: payload.description,
        p_link: payload.link
      });
      if (error) throw error;
      localStorage.removeItem(todoDraftKey);
    }
    closeDialog();
    await loadTodos();
  } catch (error) {
    setFormStatus(error.message || "Impossible d’enregistrer le devoir. Le brouillon est conservé.", "danger");
  } finally {
    button.disabled = false;
  }
}

async function toggleHomework(id, checked) {
  const request = checked
    ? todo.client.from("homework_progress").upsert({ homework_id: id, user_id: todo.user.id })
    : todo.client.from("homework_progress").delete().eq("homework_id", id);
  const { error } = await request;
  if (error) {
    setTodoStatus("Impossible de mettre à jour ta progression : " + error.message, "danger");
    return loadTodos();
  }
  checked ? todo.doneIds.add(id) : todo.doneIds.delete(id);
  renderTodos();
}

async function deleteHomework(id) {
  if (!confirm("Supprimer ce devoir pour toute la promo ?")) return;
  const { error } = await todo.client.from("homeworks").delete().eq("id", id);
  if (error) return setTodoStatus(error.message, "danger");
  await loadTodos();
}

function subscribeToTodos() {
  todo.client.channel("homeworks-fi1g2")
    .on("postgres_changes", { event: "*", schema: "public", table: "homeworks", filter: "group_id=eq." + todoGroup }, loadTodos)
    .on("postgres_changes", { event: "*", schema: "public", table: "homework_progress", filter: "user_id=eq." + todo.user.id }, loadTodos)
    .subscribe();
}

todoElement("#agenda-tab").addEventListener("click", () => { location.hash = "agenda"; });
todoElement("#todo-tab").addEventListener("click", () => { location.hash = "devoirs"; });
window.addEventListener("hashchange", updateNavigation);
todoElement("#add-homework-button").addEventListener("click", () => openDialog());
todoElement("#close-homework-dialog").addEventListener("click", closeDialog);
todoElement("#cancel-homework-dialog").addEventListener("click", closeDialog);
todoForm.addEventListener("input", saveDraft);
todoForm.addEventListener("submit", saveHomework);
todoList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const task = todo.tasks.find((item) => item.id === button.dataset.id);
  if (button.dataset.action === "edit" && task) openDialog(task);
  if (button.dataset.action === "delete") deleteHomework(button.dataset.id);
});
todoList.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.action === "toggle") toggleHomework(input.dataset.id, input.checked);
});
document.querySelectorAll("[data-todo-filter]").forEach((button) => button.addEventListener("click", () => {
  todo.archives = false;
  todo.filter = button.dataset.todoFilter;
  document.querySelectorAll("[data-todo-filter]").forEach((item) => item.className = "btn btn-sm btn-outline-primary");
  button.className = "btn btn-sm btn-primary";
  renderTodos();
}));
todoElement("#archives-button").addEventListener("click", () => {
  todo.archives = !todo.archives;
  todoElement("#archives-button").classList.toggle("active", todo.archives);
  renderTodos();
});
window.addEventListener("load", updateNavigation);
