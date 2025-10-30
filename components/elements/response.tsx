"use client";

import { type ComponentProps, memo, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

// lazy-loaded highlighter (browser)
let _highlighter: any = null;
async function getHighlighter() {
  if (_highlighter) return _highlighter;
  const shiki = await import("shiki");
  _highlighter = await shiki.createHighlighter({
    themes: ["github-dark", "github-light"],
    langs: ["ts","tsx","js","jsx","json","bash","python","go","rust","sql","html","css","scss","yaml","toml","md","sh"],
  });
  return _highlighter;
}

function enhanceTables(root: HTMLElement) {
  const tables = root.querySelectorAll("table");
  tables.forEach((table) => {
    const t = table as HTMLTableElement;
    if (t.dataset.enhanced === "true") return;
    t.dataset.enhanced = "true";
    t.classList.add(
      "w-full","text-sm","border-separate","border-spacing-0","my-4","rounded-md","overflow-hidden"
    );
    const thead = t.querySelector("thead");
    if (thead) {
      thead.classList.add("bg-muted");
      thead.querySelectorAll("th").forEach((th) => {
        (th as HTMLElement).classList.add("px-3","py-2","text-left","font-medium","border-b");
      });
    }
    const tbody = t.querySelector("tbody") ?? t;
    tbody.querySelectorAll("tr").forEach((tr) => {
      (tr as HTMLElement).classList.add("odd:bg-muted/30");
      tr.querySelectorAll("td").forEach((td) => {
        (td as HTMLElement).classList.add("px-3","py-2","align-top","border-b");
      });
    });
  });
}

function buildLineNumbered(html: string, raw: string) {
  const lines = raw.replace(/\n$/,"").split("\n");
  const gutter = lines.map((_,i)=>`<div class="px-3 text-right select-none opacity-60">${i+1}</div>`).join("");
  // Wrap the provided Shiki HTML inside a flex row
  return `
    <div class="flex text-sm font-mono leading-6">
      <div class="flex flex-col py-2 bg-muted/40 min-w-10 items-end">${gutter}</div>
      <div class="flex-1 overflow-x-auto">${html}</div>
    </div>
  `;
}

async function enhanceCodeBlocks(root: HTMLElement) {
  const blocks = root.querySelectorAll("pre code");
  if (blocks.length === 0) return;
  const highlighter = await getHighlighter();

  blocks.forEach((codeEl) => {
    const pre = codeEl.parentElement as HTMLPreElement | null;
    if (!pre || pre.dataset.enhanced === "true") return;
    pre.dataset.enhanced = "true";

    const className = (codeEl as HTMLElement).className || "";
    const match = className.match(/language-([\w-]+)/);
    const lang = match?.[1] ?? "text";
    const raw = codeEl.textContent ?? "";

    // produce shiki HTML with both themes (use prefers-color-scheme OR local toggle)
    const htmlDark = highlighter.codeToHtml(raw, { lang, theme: "github-dark" });
    const htmlLight = highlighter.codeToHtml(raw, { lang, theme: "github-light" });

    // wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "group rounded-md border bg-muted/30 overflow-hidden my-3";
    wrapper.dataset.theme = ""; // empty -> follow system

    // header
    const header = document.createElement("div");
    header.className = "flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/40";
    const left = document.createElement("div");
    left.className = "flex items-center gap-2";
    const label = document.createElement("span");
    label.className = "font-mono uppercase truncate";
    label.textContent = lang;

    const right = document.createElement("div");
    right.className = "flex items-center gap-2";

    // actions
    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.className = "px-2 py-0.5 rounded border bg-background hover:bg-accent transition-colors";
    btnCopy.textContent = "Copiar";
    btnCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(raw);
        btnCopy.textContent = "Copiado!";
        setTimeout(() => (btnCopy.textContent = "Copiar"), 1200);
      } catch {}
    });

    const btnDownload = document.createElement("button");
    btnDownload.type = "button";
    btnDownload.className = "px-2 py-0.5 rounded border bg-background hover:bg-accent transition-colors";
    btnDownload.textContent = "Baixar";
    btnDownload.addEventListener("click", () => {
      const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `code-${lang || "txt"}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    });

    const btnExpand = document.createElement("button");
    btnExpand.type = "button";
    btnExpand.className = "px-2 py-0.5 rounded border bg-background hover:bg-accent transition-colors";
    btnExpand.textContent = "Expandir";
    btnExpand.addEventListener("click", () => {
      const isCollapsed = wrapper.dataset.collapsed === "true";
      if (isCollapsed) {
        wrapper.dataset.collapsed = "false";
        btnExpand.textContent = "Recolher";
        content.classList.remove("max-h-96");
      } else {
        wrapper.dataset.collapsed = "true";
        btnExpand.textContent = "Expandir";
        content.classList.add("max-h-96");
      }
    });

    const btnTheme = document.createElement("button");
    btnTheme.type = "button";
    btnTheme.className = "px-2 py-0.5 rounded border bg-background hover:bg-accent transition-colors";
    btnTheme.textContent = "Tema";
    btnTheme.title = "Alternar tema Light/Dark deste bloco";
    btnTheme.addEventListener("click", () => {
      const cur = wrapper.dataset.theme;
      if (cur === "dark") {
        wrapper.dataset.theme = "light";
      } else if (cur === "light") {
        wrapper.dataset.theme = "";
      } else {
        wrapper.dataset.theme = "dark";
      }
      // update visibility
      updateThemeVisibility();
    });

    left.appendChild(label);
    right.appendChild(btnCopy);
    right.appendChild(btnDownload);
    right.appendChild(btnExpand);
    right.appendChild(btnTheme);
    header.appendChild(left);
    header.appendChild(right);

    // content container with theme switching
    const content = document.createElement("div");
    content.className = "relative overflow-auto";
    const innerDark = document.createElement("div");
    innerDark.className = "shiki-dark";
    innerDark.innerHTML = buildLineNumbered(htmlDark, raw);
    const innerLight = document.createElement("div");
    innerLight.className = "shiki-light";
    innerLight.innerHTML = buildLineNumbered(htmlLight, raw);

    content.appendChild(innerDark);
    content.appendChild(innerLight);

    const updateThemeVisibility = () => {
      const forced = wrapper.dataset.theme;
      // default: follow system via prefers-color-scheme (tailwind 'dark' class)
      if (forced === "dark") {
        innerDark.style.display = "block";
        innerLight.style.display = "none";
      } else if (forced === "light") {
        innerDark.style.display = "none";
        innerLight.style.display = "block";
      } else {
        // system
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          innerDark.style.display = "block";
          innerLight.style.display = "none";
        } else {
          innerDark.style.display = "none";
          innerLight.style.display = "block";
        }
      }
    };

    // collapse if many lines
    const lineCount = (raw.match(/\n/g) || []).length + 1;
    if (lineCount > 16) {
      wrapper.dataset.collapsed = "true";
      content.classList.add("max-h-96");
      const fade = document.createElement("div");
      fade.className = "pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/70 to-transparent";
      content.appendChild(fade);
    }

    // replace pre with wrapper
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    pre.replaceWith(wrapper);

    updateThemeVisibility();
  });
}

function enhanceInlineCode(root: HTMLElement) {
  root.querySelectorAll(":not(pre) > code").forEach((el) => {
    const e = el as HTMLElement;
    if (e.dataset.enhanced === "true") return;
    e.dataset.enhanced = "true";
    e.classList.add("rounded","bg-muted","px-1","py-0.5","text-sm");
  });
}


// --- Enhancers: reasoning, cards, mini-forms ---
function enhanceReasoning(root: HTMLElement) {
  // Collapse fenced blocks marked as ```reasoning
  const nodes = root.querySelectorAll("pre code.language-reasoning");
  nodes.forEach((codeEl) => {
    const pre = codeEl.parentElement as HTMLPreElement | null;
    if (!pre || pre.dataset.enhancedReasoning === "true") return;
    pre.dataset.enhancedReasoning = "true";
    const raw = codeEl.textContent ?? "";
    const details = document.createElement("details");
    details.className = "rounded-md border bg-muted/20 my-3";
    const summary = document.createElement("summary");
    summary.className = "px-3 py-2 cursor-pointer text-sm text-muted-foreground";
    summary.textContent = "Mostrar passos (raciocínio)";
    const body = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = raw;
    body.appendChild(code);
    body.className = "max-w-full overflow-x-auto px-3 pb-3 text-xs";
    details.appendChild(summary);
    details.appendChild(body);
    pre.replaceWith(details);
  });
}

function parseJsonSafe(s: string): any | null {
  try { return JSON.parse(s); } catch { return null; }
}

function enhanceCards(root: HTMLElement) {
  // Blocks like ```card or ```card-contract
  const nodes = root.querySelectorAll("pre code[class*='language-card']");
  nodes.forEach((codeEl) => {
    const pre = codeEl.parentElement as HTMLPreElement | null;
    if (!pre || pre.dataset.enhancedCard === "true") return;
    pre.dataset.enhancedCard = "true";
    const cls = (codeEl as HTMLElement).className || "";
    const isContract = /language-card-contract/.test(cls);
    const isCustomer = /language-card-customer/.test(cls);
    const raw = codeEl.textContent ?? "";
    const data = parseJsonSafe(raw) ?? {};

    const wrap = document.createElement("div");
    wrap.className = "rounded-md border bg-card text-card-foreground p-4 my-3 shadow-sm";

    const head = document.createElement("div");
    head.className = "flex items-center justify-between gap-2 mb-2";
    const title = document.createElement("div");
    title.className = "font-semibold leading-tight";
    const sub = document.createElement("div");
    sub.className = "text-xs text-muted-foreground";
    head.appendChild(title);
    head.appendChild(sub);

    const body = document.createElement("div");
    body.className = "grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm";

    const actions = document.createElement("div");
    actions.className = "mt-3 flex flex-wrap gap-2";

    function addField(label: string, value: any) {
      if (value === undefined || value === null || value === "") return;
      const item = document.createElement("div");
      const l = document.createElement("div"); l.className = "text-xs uppercase text-muted-foreground"; l.textContent = label;
      const v = document.createElement("div"); v.className = "font-medium"; v.textContent = String(value);
      item.appendChild(l); item.appendChild(v);
      body.appendChild(item);
    }

    function addAction(name: string, payload: any) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "px-2 py-1 rounded border bg-background hover:bg-accent text-xs";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        const ev = new CustomEvent("chat-action", { detail: { action: name, payload } });
        window.dispatchEvent(ev);
      });
      actions.appendChild(btn);
    }

    // Titles
    if (isContract) {
      title.textContent = data.title ?? "Contrato";
      sub.textContent = data.id ? `#${data.id}` : "Contrato";
      addField("Valor", data.amount);
      addField("Moeda", data.currency);
      addField("Cliente", data.customerName ?? data.customerId);
      addField("Vencimento", data.dueDate);
      addField("Status", data.status);
      addAction("Ver", { type: "contract.view", id: data.id });
      addAction("Editar", { type: "contract.edit", id: data.id });
      addAction("Criar Projeto", { type: "project.create", for: data.customerId ?? data.customerName });
      addAction("Adicionar Contato", { type: "contact.add", customerId: data.customerId });
    } else if (isCustomer) {
      title.textContent = data.name ?? "Cliente";
      sub.textContent = data.id ? `#${data.id}` : "Cliente";
      addField("Email", data.email);
      addField("Telefone", data.phone);
      addField("Empresa", data.company);
      addField("Criado em", data.createdAt);
      addAction("Ver", { type: "customer.view", id: data.id });
      addAction("Editar", { type: "customer.edit", id: data.id });
      addAction("Novo Contrato", { type: "contract.create", customerId: data.id });
      addAction("Agendar Reunião", { type: "meeting.schedule", customerId: data.id });
    } else {
      title.textContent = data.title ?? "Card";
      sub.textContent = data.subtitle ?? "";
      Object.keys(data).forEach((k) => addField(k, data[k]));
      addAction("Abrir", { type: "card.open", data });
    }

    wrap.appendChild(head);
    wrap.appendChild(body);
    wrap.appendChild(actions);
    pre.replaceWith(wrap);
  });
}

function enhanceMiniForms(root: HTMLElement) {
  // Blocks like ```form-schedule with JSON payload
  const nodes = root.querySelectorAll("pre code.language-form-schedule");
  nodes.forEach((codeEl) => {
    const pre = codeEl.parentElement as HTMLPreElement | null;
    if (!pre || pre.dataset.enhancedForm === "true") return;
    pre.dataset.enhancedForm = "true";

    const raw = codeEl.textContent ?? "";
    const data = parseJsonSafe(raw) ?? {};
    const form = document.createElement("form");
    form.className = "rounded-md border p-3 my-3 bg-muted/20 flex flex-col gap-2";

    const title = document.createElement("div");
    title.className = "text-sm font-medium";
    title.textContent = data.title ?? "Agendar";
    form.appendChild(title);

    const row = document.createElement("div");
    row.className = "flex gap-2 flex-wrap";
    const date = document.createElement("input");
    date.type = "date"; date.value = (data.initialDate || "").slice(0,10); date.className = "px-2 py-1 rounded border bg-background";
    const time = document.createElement("input");
    time.type = "time"; time.value = (data.initialTime || ""); time.className = "px-2 py-1 rounded border bg-background";
    row.appendChild(date); row.appendChild(time);
    form.appendChild(row);

    const actions = document.createElement("div");
    actions.className = "flex gap-2";
    const submit = document.createElement("button");
    submit.type = "submit"; submit.className = "px-2 py-1 rounded border bg-background hover:bg-accent text-xs"; submit.textContent = "Salvar";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "px-2 py-1 rounded border bg-background hover:bg-accent text-xs"; cancel.textContent = "Cancelar";
    actions.appendChild(submit); actions.appendChild(cancel);
    form.appendChild(actions);

    cancel.addEventListener("click", () => {
      const ev = new CustomEvent("chat-form-cancel", { detail: { kind: "schedule" } });
      window.dispatchEvent(ev);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = {
        kind: "schedule",
        date: (date as HTMLInputElement).value,
        time: (time as HTMLInputElement).value,
        meta: data.meta ?? {},
      };
      const ev = new CustomEvent("chat-form-submit", { detail: payload });
      window.dispatchEvent(ev);
    });

    pre.replaceWith(form);
  });
}


export const Response = memo(
  ({ className, ...props }: ResponseProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      const run = () => {
        enhanceTables(el);
        enhanceInlineCode(el);
        enhanceReasoning(el);
        enhanceCards(el);
        enhanceMiniForms(el);
        // code blocks are async due to shiki
        enhanceCodeBlocks(el);
      };

      // initial pass
      run();

      // observe updates (Streamdown appends content as it streams)
      const mo = new MutationObserver(() => run());
      mo.observe(el, { childList: true, subtree: true });
      return () => mo.disconnect();
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          "prose dark:prose-invert max-w-none size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_code]:break-words",
          className
        )}
      >
        <Streamdown {...props} />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
