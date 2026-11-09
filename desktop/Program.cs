using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ReadTree
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

        [STAThread]
        private static void Main()
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
            catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                Application.Run(new MainForm());
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "ReadTree 启动失败：" + Environment.NewLine + error.Message,
                    "ReadTree",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 webView;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private readonly string rootDir;
        private readonly string appDir;
        private readonly string dataDir;
        private readonly string lastFile;
        private readonly Timer debounce;

        private FileSystemWatcher watcher;
        private string activePath;
        private bool readyHandled;

        public MainForm()
        {
            Text = "ReadTree";
            MinimumSize = new Size(900, 600);
            try
            {
                Rectangle area = Screen.PrimaryScreen.WorkingArea;
                int width = Math.Min(1280, area.Width - 80);
                int height = Math.Min(820, area.Height - 80);
                ClientSize = new Size(Math.Max(900, width), Math.Max(600, height));
            }
            catch
            {
                ClientSize = new Size(1280, 820);
            }
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            AutoScaleMode = AutoScaleMode.Dpi;

            try
            {
                System.Drawing.Icon appIcon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (appIcon != null) Icon = appIcon;
            }
            catch { }

            rootDir = ResolveRoot();
            appDir = Path.Combine(rootDir, "app");
            dataDir = Path.Combine(appDir, "data");
            lastFile = Path.Combine(rootDir, "last.txt");
            Directory.CreateDirectory(dataDir);

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            webView.DefaultBackgroundColor = Color.White;
            Controls.Add(webView);

            debounce = new Timer();
            debounce.Interval = 650;
            debounce.Tick += OnDebounceTick;

            FormClosing += OnFormClosing;
            Shown += OnShown;
        }

        private static string ResolveRoot()
        {
            string preferred = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ReadTree"
            );
            try
            {
                Directory.CreateDirectory(preferred);
                return preferred;
            }
            catch
            {
            }

            string fallback = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ReadTreeData");
            Directory.CreateDirectory(fallback);
            return fallback;
        }

        private async void OnShown(object sender, EventArgs e)
        {
            try
            {
                string indexFile = Path.Combine(appDir, "index.html");
                WriteEmbeddedApp(indexFile);

                string userDataDir = Path.Combine(rootDir, "WebView2");
                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(
                    null,
                    userDataDir,
                    null
                );
                await webView.EnsureCoreWebView2Async(environment);

                CoreWebView2 core = webView.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.SetVirtualHostNameToFolderMapping(
                    "readtree.local",
                    appDir,
                    CoreWebView2HostResourceAccessKind.Allow
                );
                core.WebMessageReceived += OnWebMessageReceived;
                core.DownloadStarting += OnDownloadStarting;
                core.Navigate("https://readtree.local/index.html?v=" + DateTime.Now.Ticks.ToString());
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "无法启动界面组件 WebView2。" + Environment.NewLine +
                    "请确认已安装 Microsoft Edge WebView2 Runtime。" + Environment.NewLine + Environment.NewLine +
                    error.Message,
                    "ReadTree",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private void WriteEmbeddedApp(string indexFile)
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            Stream stream = assembly.GetManifestResourceStream("ReadTree.app.html");
            if (stream == null) throw new InvalidOperationException("内置页面缺失");

            try
            {
                using (stream)
                {
                    using (FileStream file = new FileStream(
                        indexFile,
                        FileMode.Create,
                        FileAccess.Write,
                        FileShare.Read
                    ))
                    {
                        stream.CopyTo(file);
                    }
                }
            }
            catch
            {
                // Keep the previous copy when the file is temporarily locked.
            }
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                Dictionary<string, object> message =
                    json.DeserializeObject(e.WebMessageAsJson) as Dictionary<string, object>;
                if (message == null || !message.ContainsKey("type")) return;

                string type = Convert.ToString(message["type"]);
                if (type == "open") OpenFile();
                else if (type == "ready") RestoreLastFile();
                else if (type == "stop") StopWatching(true);
            }
            catch { }
        }

        private void OpenFile()
        {
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "打开 Excel";
                dialog.Filter = "Excel 文件|*.xlsx;*.xls;*.csv|所有文件|*.*";
                dialog.CheckFileExists = true;
                try
                {
                    if (File.Exists(lastFile))
                    {
                        string previous = File.ReadAllText(lastFile, Encoding.UTF8).Trim();
                        if (previous.Length > 0) dialog.InitialDirectory = Path.GetDirectoryName(previous);
                    }
                }
                catch { }
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                LoadPath(dialog.FileName, "open");
            }
        }

        private void RestoreLastFile()
        {
            if (readyHandled) return;
            readyHandled = true;

            try
            {
                if (!File.Exists(lastFile)) return;
                string path = File.ReadAllText(lastFile, Encoding.UTF8).Trim();
                if (path.Length > 0 && File.Exists(path)) LoadPath(path, "restore");
            }
            catch { }
        }

        private void LoadPath(string path, string reason)
        {
            try
            {
                if (!File.Exists(path)) return;

                string snapshot = CopySnapshot(path);
                try { StartWatching(path); }
                catch { }

                try { File.WriteAllText(lastFile, path, Encoding.UTF8); }
                catch { }

                Text = "ReadTree — " + Path.GetFileName(path);
                PostFile(reason, path, snapshot);
            }
            catch (Exception error)
            {
                if (reason != "restore")
                {
                    MessageBox.Show(
                        "无法读取文件：" + Environment.NewLine + error.Message,
                        "ReadTree",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
            }
        }

        private string CopySnapshot(string path)
        {
            Directory.CreateDirectory(dataDir);
            string name = "current-" + Guid.NewGuid().ToString("N") + ".xlsx";
            File.Copy(path, Path.Combine(dataDir, name), true);
            CleanSnapshots();
            return name;
        }

        private void CleanSnapshots()
        {
            try
            {
                string[] files = Directory.GetFiles(dataDir, "current-*.xlsx");
                Array.Sort(files, StringComparer.Ordinal);
                for (int index = 0; index < files.Length - 6; index++)
                {
                    try { File.Delete(files[index]); }
                    catch { }
                }
            }
            catch { }
        }

        private void PostFile(string reason, string path, string snapshot)
        {
            if (webView.CoreWebView2 == null) return;

            Dictionary<string, object> message = new Dictionary<string, object>();
            message["type"] = "file";
            message["reason"] = reason;
            message["name"] = Path.GetFileName(path);
            message["url"] =
                "https://readtree.local/data/" + snapshot + "?t=" + DateTime.Now.Ticks.ToString();

            webView.CoreWebView2.PostWebMessageAsJson(json.Serialize(message));
        }

        private void StartWatching(string path)
        {
            StopWatching(false);
            activePath = path;

            string directory = Path.GetDirectoryName(path);
            string fileName = Path.GetFileName(path);
            if (string.IsNullOrEmpty(directory)) return;

            FileSystemWatcher next = new FileSystemWatcher(directory);
            next.Filter = "*.*";
            next.NotifyFilter =
                NotifyFilters.FileName
                | NotifyFilters.LastWrite
                | NotifyFilters.Size
                | NotifyFilters.CreationTime;
            next.IncludeSubdirectories = false;

            FileSystemEventHandler changed = delegate(object sender, FileSystemEventArgs args)
            {
                if (SameFile(args.Name, fileName)) ScheduleReload();
            };
            next.Changed += changed;
            next.Created += changed;
            next.Deleted += changed;
            next.Renamed += delegate(object sender, RenamedEventArgs args)
            {
                if (SameFile(args.Name, fileName) || SameFile(args.OldName, fileName))
                {
                    ScheduleReload();
                }
            };
            next.EnableRaisingEvents = true;
            watcher = next;
        }

        private static bool SameFile(string name, string fileName)
        {
            return !string.IsNullOrEmpty(name)
                && string.Equals(name, fileName, StringComparison.OrdinalIgnoreCase);
        }

        private void ScheduleReload()
        {
            if (IsDisposed) return;
            try
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    debounce.Stop();
                    debounce.Start();
                });
            }
            catch { }
        }

        private async void OnDebounceTick(object sender, EventArgs e)
        {
            debounce.Stop();
            string path = activePath;
            if (path == null) return;

            string snapshot = null;
            for (int attempt = 0; attempt < 6; attempt++)
            {
                try
                {
                    snapshot = CopySnapshot(path);
                }
                catch
                {
                    snapshot = null;
                }

                if (snapshot != null) break;
                await Task.Delay(350);
            }

            if (snapshot == null) return;
            if (!string.Equals(activePath, path, StringComparison.Ordinal)) return;

            try
            {
                Text = "ReadTree — " + Path.GetFileName(path);
                PostFile("change", path, snapshot);
            }
            catch { }
        }

        private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            try
            {
                using (SaveFileDialog dialog = new SaveFileDialog())
                {
                    string suggested = Path.GetFileName(e.ResultFilePath);
                    if (string.IsNullOrEmpty(suggested)) suggested = "导出.csv";

                    dialog.Title = "导出 CSV";
                    dialog.FileName = suggested;
                    dialog.Filter = "CSV 文件|*.csv|所有文件|*.*";

                    if (dialog.ShowDialog(this) != DialogResult.OK)
                    {
                        e.Cancel = true;
                        return;
                    }

                    e.ResultFilePath = dialog.FileName;
                    e.Handled = true;
                }
            }
            catch { }
        }

        private void StopWatching(bool clearLast)
        {
            if (watcher != null)
            {
                try { watcher.EnableRaisingEvents = false; }
                catch { }
                try { watcher.Dispose(); }
                catch { }
                watcher = null;
            }

            activePath = null;

            if (clearLast)
            {
                try
                {
                    if (File.Exists(lastFile)) File.Delete(lastFile);
                }
                catch { }
                Text = "ReadTree";
            }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            StopWatching(false);
            debounce.Stop();
            debounce.Dispose();
        }
    }
}
