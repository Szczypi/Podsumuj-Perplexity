# Perplexity Summarizer – Dodatek do Firefoxa

Dodatek do przeglądarki Firefox, który streszcza aktualnie oglądane artykuły przy użyciu API Perplexity i wyświetla podsumowanie w panelu bocznym lub otwiera pełną odpowiedź w serwisie Perplexity.

## Funkcje

- Podsumowywanie bieżącej strony jednym kliknięciem.
- Tryb krótkiego lub dłuższego podsumowania.
- Dwa formaty wyników:
  - Jeden lub kilka akapitów,
  - Lista punktów.
- Opcja automatycznego podsumowywania nowych artykułów po załadowaniu strony.
- Możliwość wyboru:
  - Wyświetlania streszczenia w panelu bocznym Firefoxa,
  - Otwierania nowej karty z Perplexity i gotowym promptem.
- Kontekstowe menu (prawy przycisk myszy) do podsumowania całej strony lub zaznaczonego tekstu.

## Wymagania

- Firefox z obsługą WebExtensions (Manifest V3).
- Klucz API Perplexity (wstawiany w `background.js` w stałej `PERPLEXITY_API_KEY`).

## Instalacja z kodu źródłowego

Rozszerzenie można zainstalować na dwa sposoby:

1. Sklonuj repozytorium lub pobierz paczkę ZIP z GitHuba.
2. Otwórz w Firefoxie stronę `about:debugging#/runtime/this-firefox`.
3. Kliknij **Load Temporary Add-on** / **Załaduj tymczasowy dodatek**.
4. Wskaż plik `manifest.json` z folderu rozszerzenia.

Dodatek zostanie załadowany testowo (do restartu przeglądarki).

1. Kup na Allegro subskrypcje Perplexity Pro i wygeneruj klucz API.
2. Wklej klucz do pliku `background.js` i spakuj pobrane pliki w ZIP.
3. Wyślij spakowany plik do podpisu w **Mozilla ADD-ONS** / **Dodatki do Firefoxa**.
4. Otrzymany plik `perplexity-summarizer.xpi` zainstaluj w rozszerzenia.

Rozszerzenie będzie uruchamiać się z przeglądarką Firefox.

## Konfiguracja

Po zainstalowaniu:

1. Kliknij ikonę dodatku na pasku narzędzi Firefoxa.
2. W oknie ustawień wybierz:
   - Długość podsumowania: **Krótkie** lub **Długie**,
   - Format: **Akapity** lub **Punktowo**,
   - Czy podsumowanie ma:
     - Pojawiać się w panelu bocznym,
     - Otwierać się w nowej karcie Perplexity.
3. (Opcjonalnie) Włącz automatyczne podsumowywanie artykułów po załadowaniu strony.

Przycisk **„Podsumuj stronę”** użyje aktualnie zapisanych ustawień.

## Bezpieczeństwo i uprawnienia

Dodatek potrzebuje dostępu do treści stron, aby móc je streszczać. Nie zapisuje lokalnie danych logowania ani nie wysyła ich świadomie do zewnętrznych usług, do API Perplexity przekazywany jest wyłącznie tekst strony lub zaznaczonego fragmentu. Przed użyciem wrażliwych serwisów (np. bankowość, panele logowania) zaleca się świadome zarządzanie uprawnieniami rozszerzenia w ustawieniach Firefoxa.

## Licencja

MIT/X11 License.
