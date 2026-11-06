// N-API folder lister: one FindFirstFileExW pass returns names, kinds, sizes and dates as columns (ADR 0002).
#include <napi.h>
#include <windows.h>

#include <cstring>
#include <string>
#include <vector>

namespace {

constexpr unsigned long long kEpochDelta = 116444736000000000ULL;

std::wstring Widen(const std::string& s) {
  if (s.empty()) return std::wstring();
  int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring w(n, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), w.data(), n);
  return w;
}

std::wstring Extended(std::wstring path) {
  for (auto& c : path) {
    if (c == L'/') c = L'\\';
  }
  if (path.rfind(L"\\\\?\\", 0) == 0) return path;
  DWORD n = GetFullPathNameW(path.c_str(), 0, nullptr, nullptr);
  if (n == 0) return path;
  std::wstring full(n, L'\0');
  n = GetFullPathNameW(path.c_str(), n, full.data(), nullptr);
  full.resize(n);
  if (full.rfind(L"\\\\", 0) == 0) return L"\\\\?\\UNC\\" + full.substr(2);
  return L"\\\\?\\" + full;
}

double ToMs(const FILETIME& ft) {
  unsigned long long t = (static_cast<unsigned long long>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
  if (t < kEpochDelta) return 0;
  return static_cast<double>((t - kEpochDelta) / 10000ULL);
}

const char* CodeFor(DWORD err, const std::wstring& dir) {
  switch (err) {
    case ERROR_ACCESS_DENIED:
    case ERROR_SHARING_VIOLATION:
      return "EACCES";
    case ERROR_FILE_NOT_FOUND:
    case ERROR_PATH_NOT_FOUND:
    case ERROR_DIRECTORY:
    case ERROR_INVALID_NAME:
    case ERROR_BAD_NETPATH:
    case ERROR_BAD_NET_NAME: {
      DWORD attrs = GetFileAttributesW(dir.c_str());
      if (attrs == INVALID_FILE_ATTRIBUTES) return "ENOENT";
      if (!(attrs & FILE_ATTRIBUTE_DIRECTORY)) return "ENOTDIR";
      return nullptr;
    }
    default:
      return "EIO";
  }
}

Napi::Value Fail(Napi::Env env, const char* code, DWORD err, const std::string& path) {
  Napi::Error e = Napi::Error::New(env, std::string(code) + ": cannot list '" + path + "'");
  e.Set("code", Napi::String::New(env, code));
  e.Set("errno", Napi::Number::New(env, static_cast<double>(err)));
  e.Set("path", Napi::String::New(env, path));
  e.ThrowAsJavaScriptException();
  return env.Undefined();
}

template <typename T, typename A>
A Column(Napi::Env env, const std::vector<T>& values) {
  A out = A::New(env, values.size());
  if (!values.empty()) std::memcpy(out.Data(), values.data(), values.size() * sizeof(T));
  return out;
}

Napi::Value List(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "list(path) needs a path string").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::wstring dir = Extended(Widen(path));
  const std::wstring pattern = dir + (dir.back() == L'\\' ? L"*" : L"\\*");

  std::vector<std::u16string> names;
  std::vector<uint8_t> kinds;
  std::vector<double> sizes, mtimes, ctimes;
  std::vector<uint32_t> attrs;

  WIN32_FIND_DATAW fd;
  HANDLE h = FindFirstFileExW(pattern.c_str(), FindExInfoBasic, &fd, FindExSearchNameMatch, nullptr, FIND_FIRST_EX_LARGE_FETCH);
  if (h == INVALID_HANDLE_VALUE) {
    DWORD err = GetLastError();
    const char* code = CodeFor(err, dir);
    if (code) return Fail(env, code, err, path);
  } else {
    do {
      const wchar_t* name = fd.cFileName;
      if (name[0] == L'.' && (name[1] == 0 || (name[1] == L'.' && name[2] == 0))) continue;
      const bool isDir = (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
      names.emplace_back(reinterpret_cast<const char16_t*>(name));
      kinds.push_back(isDir ? 1 : 0);
      sizes.push_back(isDir ? 0 : static_cast<double>((static_cast<unsigned long long>(fd.nFileSizeHigh) << 32) | fd.nFileSizeLow));
      mtimes.push_back(ToMs(fd.ftLastWriteTime));
      ctimes.push_back(ToMs(fd.ftCreationTime));
      attrs.push_back(fd.dwFileAttributes);
    } while (FindNextFileW(h, &fd));
    DWORD err = GetLastError();
    FindClose(h);
    if (err != ERROR_NO_MORE_FILES) return Fail(env, "EIO", err, path);
  }

  Napi::Array nameColumn = Napi::Array::New(env, names.size());
  for (size_t i = 0; i < names.size(); ++i) nameColumn.Set(static_cast<uint32_t>(i), Napi::String::New(env, names[i]));

  Napi::Object out = Napi::Object::New(env);
  out.Set("names", nameColumn);
  out.Set("kinds", Column<uint8_t, Napi::Uint8Array>(env, kinds));
  out.Set("sizes", Column<double, Napi::Float64Array>(env, sizes));
  out.Set("mtimes", Column<double, Napi::Float64Array>(env, mtimes));
  out.Set("ctimes", Column<double, Napi::Float64Array>(env, ctimes));
  out.Set("attrs", Column<uint32_t, Napi::Uint32Array>(env, attrs));
  return out;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("list", Napi::Function::New(env, List));
  return exports;
}

}  // namespace

NODE_API_MODULE(fs_native, Init)
