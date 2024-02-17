using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Attributes.Registration;
using CounterStrikeSharp.API.Modules.Admin;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Config;
using CounterStrikeSharp.API.Modules.Utils;
using CounterStrikeSharp.API.Modules.Cvars;
using Microsoft.Extensions.Logging;

namespace DemoRecorder;

public class DemoRecorder : BasePlugin, IPluginConfig<PluginConfig>
{
    public override string ModuleName { get; } = "DemoRecorder";
    public override string ModuleVersion { get; } = "1.0.0";
    public override string ModuleAuthor { get; } = "SAPSAN";

    public PluginConfig Config { get; set; }

    public List<CCSPlayerController> connectedPlayers = new List<CCSPlayerController>();

    public string g_sDemosName = "",
                  g_sDemosDir = "",
                  g_sServerName = "";

    public bool g_bChangeMap, bOldState;

    public void OnConfigParsed(PluginConfig config)
    {
        config = ConfigManager.Load<PluginConfig>(ModuleName);
        Config = config;
    }

    public override void Load(bool hotReload)
    {
        RegisterEventHandler<EventCsIntermission>(OnEventCsIntermissionPost);
        RegisterListener<Listeners.OnMapStart>(OnMapStartHandler);
        RegisterListener<Listeners.OnMapEnd>(OnMapEndHandler);

        g_sDemosDir = Directory.GetCurrentDirectory().Replace("bin/linuxsteamrt64", "");
        Directory.SetCurrentDirectory(g_sDemosDir);

        g_sServerName = ConVar.Find("hostname").StringValue;

        g_sDemosDir += "/csgo/addons/counterstrikesharp/data/" + Config.DemosDir;

        if (!Directory.Exists(g_sDemosDir))
        {
            Logger.LogInformation(">> Create folder for demos: {Folder}.", g_sDemosDir);

            Directory.CreateDirectory(g_sDemosDir);
        }
        g_sDemosName = new string(DateTime.Now.ToString("dd_MM_yyyy_HH_mm") + "-" + Server.MapName + ".dem");

        UploadAllDemos();
    }

    [GameEventHandler(mode: HookMode.Post)]
    private HookResult OnEventCsIntermissionPost(EventCsIntermission @event, GameEventInfo info)
    {
        RecordDemo(false, true);
        g_bChangeMap = true;
        return HookResult.Continue;
    }

    [RequiresPermissions("@css/root")]
    [ConsoleCommand("css_dr_reload")]
    public void OnReloadCommand(CCSPlayerController? controller, CommandInfo info)
    {
        OnConfigParsed(Config);
        Logger.LogInformation(">> Config reloaded!");
        controller?.PrintToChat($" {ChatColors.Red}[Demo Recorder] {ChatColors.Default}Config reloaded {ChatColors.Green}success{ChatColors.Default}!");
    }

    [GameEventHandler]
    public HookResult OnPlayerConnectedFull(EventPlayerConnectFull @event, GameEventInfo info)
    {
        var player = @event.Userid;

        if (!player.IsBot)
        {
            connectedPlayers.Add(player);

            if (GetActivePlayerCount() >= Config.MinOnline)
            {
                RecordDemo(true, false);
            }
            return HookResult.Continue;
        }
        return HookResult.Continue;
    }

    [GameEventHandler]
    public  HookResult OnPlayerDisconnect(EventPlayerDisconnect @event, GameEventInfo info)
    {
        var player = @event.Userid;

        connectedPlayers.Remove(player);

        if (GetActivePlayerCount() < Config.MinOnline)
        {
            RecordDemo(false, true);
            
        }
        return HookResult.Continue;
    }
    private void OnMapStartHandler(string mapName)
    {
        g_bChangeMap = false;
        g_sDemosName = new string(DateTime.Now.ToString("dd_MM_yyyy_HH_mm") + "-" + mapName + ".dem");
    }

    private void OnMapEndHandler()
    {
        if (!g_bChangeMap)
        {
            RecordDemo(false, false);
            g_bChangeMap = true;
        }
    }

    private void RecordDemo(bool bState, bool State)
    {
        if (g_bChangeMap)
        {
            return;
        }

        if (bState && !bOldState)
        {
            bOldState = true;

            Server.ExecuteCommand($"tv_record \"addons/counterstrikesharp/data/{Config.DemosDir}{g_sDemosName}\"");

            Logger.LogInformation(">> Recording start ({Name}).", g_sDemosName);
        }
        else if (!bState && bOldState)
        {
            bOldState = false;
            Server.ExecuteCommand($"tv_stoprecord");
            Logger.LogInformation(">> Recording stop ({Name}).", g_sDemosName);
            
            Task.Delay(800).ContinueWith((task) =>
            {
                UploadDemo(g_sDemosDir + g_sDemosName, State);
            });
        }
    }

    async void UploadDemo(string path, bool bUploadOld = false)
    {
        if (!File.Exists(path)) return;

        try
        {
            string Status = await UploadFile(path);
            
            if(!String.IsNullOrEmpty(Status))
            {
                Logger.LogInformation(">> Demo upload complete: {File}", path.Split('/').Last());
                File.Delete(path);
            }  
            else Logger.LogInformation(">> Demo upload faill: {File}", path.Split('/').Last());

        }
        catch (Exception ex)
        {
            Logger.LogInformation(">> HttpPut Exception: {ex}", ex);
        }

        if(bUploadOld)
        {
            UploadAllDemos();
        }
        
    }

    public async Task<string> UploadFile(string path)
    {
        using var client = new HttpClient();
        {
            using var content = new StreamContent(File.OpenRead(path));
            {
                content.Headers.Remove("Content-Type");
                content.Headers.Add("Content-Type", "application/octet-stream");

                using var req = new HttpRequestMessage(HttpMethod.Put, Config.UploadUrl);
                {
                    req.Headers.Add("Auth", Config.Token);
                    req.Headers.Add("Server-Name", g_sServerName);
                    req.Headers.Add("Map-Name", path.Split('-').Last().Replace(".dem", ""));
                    req.Headers.Add("Demo-Name", path.Split('/').Last());
                    req.Headers.Add("Demo-ServerId", Config.ServerId.ToString());
                    req.Headers.Add("Demo-Time", File.GetCreationTime(path).ToString());

                    req.Content = content;

                    using HttpResponseMessage resp = await client.SendAsync(req);
                    {
                        resp.EnsureSuccessStatusCode();
                        return await resp.Content.ReadAsStringAsync();
                    }
                }
            }
        }
    }
    void UploadAllDemos()
    {
        foreach (string file in Directory.GetFiles(g_sDemosDir))
        {
            Logger.LogInformation(">> Try upload old demo: {File}", file);
            UploadDemo(file);
        }
    }

    private int GetActivePlayerCount()
    {
        return connectedPlayers.Count;
    }
}
