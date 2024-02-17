using System.Text.Json.Serialization;
using CounterStrikeSharp.API.Core;

namespace DemoRecorder;

public class PluginConfig : BasePluginConfig
{
    [JsonPropertyName("MinOnline")] public int MinOnline { get; set; } = 4;
    [JsonPropertyName("ServerId")] public int ServerId { get; set; } = 1;
    [JsonPropertyName("DemosDir")] public string DemosDir { get; set; } = "demos/";
    [JsonPropertyName("Token")] public string Token { get; set; } = "";
    [JsonPropertyName("UploadUrl")] public string UploadUrl { get; set; } = "http://example.com:2053/upload";
}