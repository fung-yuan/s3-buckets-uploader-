import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import requests
import mimetypes
import os
import threading

CONTENT_TYPES = [
    ("HTML",        "text/html"),
    ("Plain Text",  "text/plain"),
    ("JSON",        "application/json"),
    ("CSS",         "text/css"),
    ("JavaScript",  "application/javascript"),
    ("XML",         "application/xml"),
    ("PDF",         "application/pdf"),
    ("JPEG Image",  "image/jpeg"),
    ("PNG Image",   "image/png"),
    ("WebP Image",  "image/webp"),
    ("GIF Image",   "image/gif"),
    ("SVG",         "image/svg+xml"),
]

def guess_content_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    for name, mime in CONTENT_TYPES:
        if mime == mimetypes.types_map.get(ext):
            return mime
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


class S3Uploader(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("S3 Uploader")
        self.geometry("820x640")
        self.minsize(600, 500)
        self.configure(bg="#f0f2f5")
        self.selected_file_path = None
        self._build_ui()

    def _build_ui(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#f0f2f5")
        style.configure("Card.TFrame", background="white", relief="flat")
        style.configure("Header.TFrame", background="#1e3a8a")
        style.configure("TLabel", background="white", foreground="#1a1a2e", font=("Segoe UI", 10))
        style.configure("Header.TLabel", background="#1e3a8a", foreground="white", font=("Segoe UI", 13, "bold"))
        style.configure("Small.TLabel", background="white", foreground="#64748b", font=("Segoe UI", 8, "bold"))
        style.configure("Preview.TLabel", background="#eff6ff", foreground="#1e40af", font=("Segoe UI", 9))
        style.configure("TEntry", fieldbackground="white", foreground="#1a1a2e", font=("Segoe UI", 10))
        style.configure("TCombobox", fieldbackground="white", foreground="#1a1a2e", font=("Segoe UI", 10))
        style.configure("Upload.TButton", background="#1e3a8a", foreground="white",
                        font=("Segoe UI", 11, "bold"), padding=(0, 8), relief="flat")
        style.map("Upload.TButton", background=[("active", "#1e40af")])
        style.configure("Tab.TButton", background="#f1f5f9", foreground="#64748b",
                        font=("Segoe UI", 10), relief="flat", padding=(12, 6))
        style.map("Tab.TButton", background=[("active", "#e2e8f0")])
        style.configure("ActiveTab.TButton", background="white", foreground="#1e3a8a",
                        font=("Segoe UI", 10, "bold"), relief="flat", padding=(12, 6))

        # Header
        header = ttk.Frame(self, style="Header.TFrame")
        header.pack(fill="x")
        ttk.Label(header, text="S3 Uploader", style="Header.TLabel").pack(padx=20, pady=12, anchor="w")

        # Scrollable main area
        canvas = tk.Canvas(self, bg="#f0f2f5", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=canvas.yview)
        self.scroll_frame = ttk.Frame(canvas, style="TFrame")
        self.scroll_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        canvas.bind_all("<MouseWheel>", lambda e: canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))

        pad = {"padx": 20, "pady": 0}

        # Card 1: Bucket config
        card1 = tk.Frame(self.scroll_frame, bg="white", bd=0, relief="flat",
                         highlightbackground="#e2e8f0", highlightthickness=1)
        card1.pack(fill="x", padx=20, pady=(16, 0))

        inner1 = tk.Frame(card1, bg="white")
        inner1.pack(fill="x", padx=16, pady=14)

        tk.Label(inner1, text="BUCKET URL", bg="white", fg="#64748b",
                 font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.bucket_var = tk.StringVar()
        self.bucket_var.trace_add("write", self._update_preview)
        bucket_entry = tk.Entry(inner1, textvariable=self.bucket_var, font=("Segoe UI", 10),
                                fg="#1a1a2e", relief="solid", bd=1, highlightthickness=0)
        bucket_entry.pack(fill="x", pady=(4, 12), ipady=6)
        bucket_entry.insert(0, "https://your-bucket.s3.amazonaws.com")
        bucket_entry.bind("<FocusIn>", lambda e: bucket_entry.delete(0, "end") if bucket_entry.get() == "https://your-bucket.s3.amazonaws.com" else None)

        row = tk.Frame(inner1, bg="white")
        row.pack(fill="x")

        path_col = tk.Frame(row, bg="white")
        path_col.pack(side="left", fill="x", expand=True, padx=(0, 10))
        tk.Label(path_col, text="FILE PATH (KEY)", bg="white", fg="#64748b",
                 font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.path_var = tk.StringVar()
        self.path_var.trace_add("write", self._update_preview)
        path_entry = tk.Entry(path_col, textvariable=self.path_var, font=("Segoe UI", 10),
                              fg="#1a1a2e", relief="solid", bd=1)
        path_entry.pack(fill="x", pady=(4, 0), ipady=6)
        path_entry.insert(0, "folder/my-file.html")

        ct_col = tk.Frame(row, bg="white")
        ct_col.pack(side="left")
        tk.Label(ct_col, text="CONTENT TYPE", bg="white", fg="#64748b",
                 font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.ct_var = tk.StringVar(value="text/html")
        ct_combo = ttk.Combobox(ct_col, textvariable=self.ct_var,
                                values=[m for _, m in CONTENT_TYPES], state="readonly",
                                font=("Segoe UI", 10), width=22)
        ct_combo.pack(pady=(4, 0), ipady=3)

        # URL preview
        self.preview_frame = tk.Frame(inner1, bg="#eff6ff", bd=0)
        self.preview_frame.pack(fill="x", pady=(10, 0))
        self.preview_label = tk.Label(self.preview_frame, text="", bg="#eff6ff", fg="#1e40af",
                                      font=("Segoe UI", 9), wraplength=740, justify="left")
        self.preview_label.pack(anchor="w", padx=10, pady=6)

        # Card 2: Content
        card2 = tk.Frame(self.scroll_frame, bg="white", bd=0, relief="flat",
                         highlightbackground="#e2e8f0", highlightthickness=1)
        card2.pack(fill="x", padx=20, pady=(12, 0))

        inner2 = tk.Frame(card2, bg="white")
        inner2.pack(fill="x", padx=16, pady=14)

        # Mode tabs
        tab_row = tk.Frame(inner2, bg="#f1f5f9", bd=0)
        tab_row.pack(anchor="w", pady=(0, 12))
        self.mode = tk.StringVar(value="text")
        self.tab_text_btn = tk.Button(tab_row, text="Paste HTML / Text",
                                      font=("Segoe UI", 10, "bold"), bg="white", fg="#1e3a8a",
                                      relief="flat", bd=0, padx=14, pady=6,
                                      command=lambda: self._set_mode("text"), cursor="hand2")
        self.tab_text_btn.pack(side="left", padx=4, pady=4)
        self.tab_file_btn = tk.Button(tab_row, text="Upload File",
                                      font=("Segoe UI", 10), bg="#f1f5f9", fg="#64748b",
                                      relief="flat", bd=0, padx=14, pady=6,
                                      command=lambda: self._set_mode("file"), cursor="hand2")
        self.tab_file_btn.pack(side="left", padx=(0, 4), pady=4)

        # Text area
        self.text_frame = tk.Frame(inner2, bg="white")
        self.text_frame.pack(fill="both")
        self.text_area = scrolledtext.ScrolledText(
            self.text_frame, font=("Consolas", 10), fg="#1a1a2e", bg="#fafafa",
            relief="solid", bd=1, wrap="word", height=14,
            insertbackground="#1e3a8a"
        )
        self.text_area.pack(fill="both", expand=True)
        self.text_area.insert("1.0", "<!-- Paste your HTML, text, or any content here -->")
        self.text_area.bind("<FocusIn>", lambda e: self._clear_placeholder())

        # File zone
        self.file_frame = tk.Frame(inner2, bg="#fafafa", bd=1, relief="solid",
                                   highlightbackground="#cbd5e1", highlightthickness=1)
        self.file_label = tk.Label(self.file_frame, text="Click to select a file\n(PDF, image, HTML, or any file)",
                                   bg="#fafafa", fg="#94a3b8", font=("Segoe UI", 11), cursor="hand2")
        self.file_label.pack(expand=True, pady=50)
        self.file_frame.bind("<Button-1>", lambda e: self._pick_file())
        self.file_label.bind("<Button-1>", lambda e: self._pick_file())

        # Upload button
        self.upload_btn = tk.Button(
            self.scroll_frame, text="Upload to S3",
            font=("Segoe UI", 11, "bold"), bg="#1e3a8a", fg="white",
            relief="flat", bd=0, pady=12, cursor="hand2",
            activebackground="#1e40af", activeforeground="white",
            command=self._upload
        )
        self.upload_btn.pack(fill="x", padx=20, pady=(14, 4))

        # Status
        self.status_frame = tk.Frame(self.scroll_frame, bg="#f0f2f5")
        self.status_frame.pack(fill="x", padx=20, pady=(0, 20))
        self.status_label = tk.Label(self.status_frame, text="", font=("Segoe UI", 10),
                                     bg="#f0f2f5", wraplength=760, justify="left")
        self.status_label.pack(anchor="w")

    def _clear_placeholder(self):
        content = self.text_area.get("1.0", "end-1c")
        if content == "<!-- Paste your HTML, text, or any content here -->":
            self.text_area.delete("1.0", "end")

    def _update_preview(self, *_):
        bucket = self.bucket_var.get().rstrip("/")
        path = self.path_var.get().lstrip("/")
        if bucket and path and not bucket.endswith("amazonaws.com"):
            url = f"{bucket}/{path}"
            self.preview_label.config(text=f"Full URL →  {url}")
            self.preview_frame.pack(fill="x", pady=(10, 0))
        elif bucket and path:
            url = f"{bucket}/{path}"
            self.preview_label.config(text=f"Full URL →  {url}")
            self.preview_frame.pack(fill="x", pady=(10, 0))
        else:
            self.preview_frame.pack_forget()

    def _set_mode(self, mode):
        self.mode.set(mode)
        if mode == "text":
            self.file_frame.pack_forget()
            self.text_frame.pack(fill="both")
            self.tab_text_btn.config(bg="white", fg="#1e3a8a", font=("Segoe UI", 10, "bold"))
            self.tab_file_btn.config(bg="#f1f5f9", fg="#64748b", font=("Segoe UI", 10))
        else:
            self.text_frame.pack_forget()
            self.file_frame.pack(fill="both", expand=True, ipady=40)
            self.tab_file_btn.config(bg="white", fg="#1e3a8a", font=("Segoe UI", 10, "bold"))
            self.tab_text_btn.config(bg="#f1f5f9", fg="#64748b", font=("Segoe UI", 10))

    def _pick_file(self):
        path = filedialog.askopenfilename(
            title="Select a file",
            filetypes=[
                ("All files", "*.*"),
                ("HTML files", "*.html *.htm"),
                ("PDF files", "*.pdf"),
                ("Image files", "*.jpg *.jpeg *.png *.gif *.webp *.svg"),
                ("Text files", "*.txt *.csv *.json *.xml *.js *.css"),
            ]
        )
        if not path:
            return
        self.selected_file_path = path
        name = os.path.basename(path)
        size_kb = os.path.getsize(path) / 1024
        self.file_label.config(
            text=f"{name}\n{size_kb:.1f} KB  ·  Click to change",
            fg="#1a1a2e", font=("Segoe UI", 11, "bold")
        )
        # Auto-fill file path and content type
        if not self.path_var.get() or self.path_var.get() == "folder/my-file.html":
            self.path_var.set(name)
        guessed = guess_content_type(name)
        if guessed:
            self.ct_var.set(guessed)

    def _get_full_url(self):
        bucket = self.bucket_var.get().rstrip("/")
        path = self.path_var.get().lstrip("/")
        return f"{bucket}/{path}"

    def _upload(self):
        bucket = self.bucket_var.get().strip()
        path = self.path_var.get().strip()
        content_type = self.ct_var.get()
        mode = self.mode.get()

        if not bucket or bucket == "https://your-bucket.s3.amazonaws.com":
            self._show_status("error", "Enter your bucket URL first.")
            return
        if not path or path == "folder/my-file.html":
            self._show_status("error", "Enter a file path (key) for the S3 object.")
            return
        if mode == "text":
            content = self.text_area.get("1.0", "end-1c")
            if not content.strip() or content == "<!-- Paste your HTML, text, or any content here -->":
                self._show_status("error", "Content is empty.")
                return
        else:
            if not self.selected_file_path:
                self._show_status("error", "No file selected.")
                return

        url = self._get_full_url()
        self.upload_btn.config(state="disabled", text="Uploading...")
        self._show_status("info", f"Uploading to {url} ...")

        def do_upload():
            try:
                if mode == "text":
                    data = self.text_area.get("1.0", "end-1c").encode("utf-8")
                else:
                    with open(self.selected_file_path, "rb") as f:
                        data = f.read()

                resp = requests.put(
                    url,
                    data=data,
                    headers={"Content-Type": content_type},
                    timeout=30,
                )
                if resp.status_code in (200, 201, 204):
                    self.after(0, lambda: self._show_status("success", f"Uploaded!  URL: {url}"))
                else:
                    self.after(0, lambda: self._show_status("error",
                        f"Upload failed — HTTP {resp.status_code}\n{resp.text[:300]}"))
            except Exception as ex:
                self.after(0, lambda: self._show_status("error", f"Error: {ex}"))
            finally:
                self.after(0, lambda: self.upload_btn.config(state="normal", text="Upload to S3"))

        threading.Thread(target=do_upload, daemon=True).start()

    def _show_status(self, kind, msg):
        colors = {
            "success": ("#166534", "#f0fdf4", "#bbf7d0"),
            "error":   ("#991b1b", "#fef2f2", "#fecaca"),
            "info":    ("#1e40af", "#eff6ff", "#bfdbfe"),
        }
        fg, bg, border = colors.get(kind, ("#333", "white", "#e2e8f0"))
        self.status_label.config(text=msg, fg=fg, bg=bg)
        self.status_frame.config(bg=bg,
            highlightbackground=border, highlightthickness=1, bd=1, relief="solid")
        self.status_label.config(bg=bg)


if __name__ == "__main__":
    app = S3Uploader()
    app.mainloop()
