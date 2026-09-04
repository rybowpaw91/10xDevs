# Ideas Notes – aplikacja do optymalizacji załadunku transportu

*Notatka robocza, kurs 10xDevs. Ma służyć jako input do wygenerowania PRD.*

## 1. Problem

Osoby organizujące transport towarów (spedytorzy, magazynierzy, kierowcy, właściciele małych firm transportowych) muszą ręcznie decydować, ile towaru zmieści się na dany pojazd i jak go rozmieścić. Robione „na oko” lub w Excelu prowadzi do:
- niepełnego wykorzystania przestrzeni ładunkowej,
- niepotrzebnych dodatkowych kursów,
- błędów przy planowaniu (towar się nie mieści, przekroczony udźwig).

## 2. Pomysł / rozwiązanie

Aplikacja, która na podstawie:
- listy towarów do zapakowania (wymiary, ilość, ew. waga),
- parametrów pojazdu (wymiary przestrzeni ładunkowej, maks. udźwig),

automatycznie wylicza:
- ile towaru zmieści się jednorazowo na dany pojazd,
- jak go optymalnie upakować (propozycja układu / plan załadunku),
- ile kursów/pojazdów potrzeba, jeśli towar się nie mieści za jednym razem.

To zadanie typu **3D bin packing / knapsack** – klasyczny problem optymalizacyjny (NP-trudny), w praktyce rozwiązywany heurystykami.

## 3. Grupa docelowa (do doprecyzowania)

- Małe/średnie firmy transportowo-spedycyjne
- Magazyny wysyłające własnym transportem
- Kierowcy/dyspozytorzy planujący załadunek
- Osoby prywatne przy przeprowadzce (mniej prawdopodobne jako główny target)

## 4. Kluczowe dane wejściowe (wstępny model)

**Towar (per pozycja):**
- nazwa / identyfikator
- długość, szerokość, wysokość
- waga (opcjonalnie na start?)
- ilość sztuk
- czy można obracać (wszystkie osie czy tylko niektóre)
- czy można stackować (piętrować) inne towary na nim
- kruchość / ograniczenia ułożenia (opcjonalnie)

**Pojazd:**
- długość, szerokość, wysokość przestrzeni ładunkowej
- maksymalny udźwig
- (opcjonalnie) kilka typów pojazdów do wyboru z bazy (bus, TIR, przyczepa itd.)

## 5. Wynik działania aplikacji

- Informacja, czy cały towar mieści się w jednym kursie
- Jeśli nie – podział na kursy / propozycja liczby potrzebnych pojazdów
- Plan/wizualizacja rozmieszczenia towaru w przestrzeni ładunkowej (2D rzut lub 3D)
- Wykorzystanie przestrzeni (np. % objętości) i wykorzystanie udźwigu

## 6. Rozważania algorytmiczne

- Problem 3D bin packing – heurystyki: First Fit Decreasing, greedy layer-based, ewentualnie algorytmy genetyczne
- Możliwe wykorzystanie gotowych bibliotek (np. py3dbp) lub solverów (np. Google OR-Tools) zamiast pisania algorytmu od zera
- Ograniczenia do uwzględnienia: waga/udźwig, stackowanie, orientacja towaru, ew. kolejność rozładunku (LIFO względem trasy)
- Trade-off: dokładność optymalizacji vs. czas obliczeń vs. złożoność implementacji w ramach kursu

## 7. Potencjalne funkcje dodatkowe (poza MVP)

- Wizualizacja 3D załadunku (obrót, podgląd)
- Obsługa wielu pojazdów jednocześnie (flota) i przydział towaru do pojazdów
- Import listy towarów z pliku (CSV/Excel)
- Uwzględnienie kolejności rozładunku na trasie z wieloma przystankami
- Zapisywanie i porównywanie wariantów załadunku
- Uwzględnienie środka ciężkości / rozkładu masy

## 8. Otwarte pytania (do PRD)

- Kto jest głównym użytkownikiem MVP – jedna osoba planująca pojedynczy kurs, czy firma z flotą?
- Web czy aplikacja mobilna? (Kierowca może potrzebować mobile)
- Czy MVP obsługuje tylko jeden pojazd/jeden kurs, czy od razu wiele?
- Czy waga/udźwig wchodzi do MVP, czy tylko wymiary/objętość na start?
- Jak dokładna ma być wizualizacja – wystarczy liczba/procent wykorzystania, czy potrzebny graficzny plan załadunku?
- Skąd dane wejściowe: ręczne wprowadzanie w formularzu, import pliku, integracja z innym systemem (WMS/ERP)?
- Czy towary mogą być nieprostopadłościenne (walce, worki) czy zakładamy tylko prostopadłościany?

## 9. Poza zakresem na start (propozycja)

- Integracje z zewnętrznymi systemami (WMS/ERP, śledzenie GPS)
- Routing / planowanie trasy
- Towary o nieregularnych kształtach
- Obsługa wielu jednoczesnych użytkowników / współdzielenie planów w zespole

## 10. Wstępne metryki sukcesu (do doprecyzowania)

- Redukcja liczby kursów potrzebnych do przewiezienia danej partii towaru
- Wzrost % wykorzystania przestrzeni ładunkowej względem planowania ręcznego
- Czas potrzebny na wygenerowanie planu załadunku
