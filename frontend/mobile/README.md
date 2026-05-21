# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Icon Attribution

This project uses [Lucide](https://lucide.dev/) icons.

- Icon set: Lucide
- Package: `lucide-react-native`
- License: ISC License
- Usage: Navigation icons and category icons in the Moni mobile frontend

## Frontend Design Resources

### Font

This project uses Pretendard for the Moni mobile frontend.

- Font: Pretendard
- Source: https://github.com/orioncactus/pretendard
- License: SIL Open Font License 1.1
- Usage: Main UI font for the React Native + Expo mobile app
- Local file path: `frontend/mobile/assets/fonts/PretendardVariable.ttf`

Font files are not redistributed separately in this documentation. Please download Pretendard from the official source.

### Icons

This project uses Lucide icons for navigation and category UI.

- Icon set: Lucide
- Package: `lucide-react-native`
- Source: https://lucide.dev/
- License: ISC License
- Usage: Bottom navigation icons, category icons, report/action icons

### Visual Direction

The Moni mobile frontend uses a butter-colored glassmorphism style with soft jelly motion.

Main principles:

- Soft butter and neutral background colors
- Translucent glass cards with highlight reflections
- Rounded jelly-like surfaces
- Short elastic motion for navigation and category selection
- Pretendard typography
- Cute game-like UI elements for challenge, XP, and level feedback

## Frontend Design Resources

### Design Direction

Moni mobile frontend uses a butter-colored glassmorphism and jelly-motion style.

Main principles:

- Butter yellow and warm cream color palette
- Translucent glass cards with soft reflected light
- Rounded jelly-like surfaces
- Short elastic motion for tab navigation and category selection
- Game-like reward UI for challenges, XP, and level progress
- Pretendard-based Korean typography
- Lucide-based public icon system

### Font

This project uses Pretendard as the main UI font.

- Font: Pretendard
- Source: https://github.com/orioncactus/pretendard
- License: SIL Open Font License 1.1
- Usage: Main UI font for the React Native + Expo mobile app
- Local path: `frontend/mobile/assets/fonts/PretendardVariable.ttf`

Font files are not redistributed separately in this documentation. Download Pretendard from the official source.

### Icons

This project uses Lucide icons for navigation, category UI, and report/action icons.

- Icon set: Lucide
- Package: `lucide-react-native`
- Source: https://lucide.dev/
- License: ISC License
- Usage:
  - Bottom navigation icons
  - Category icons
  - Challenge/report/action icons

### UI Components

Main custom frontend components:

- `AnimatedButton.tsx`
  - Butter-colored jelly button
  - Press animation and haptic feedback

- `GlassCard.tsx`
  - Translucent glass card
  - Soft reflected light
  - Entry animation on tab focus

- `JellyTabBar.tsx`
  - Custom bottom navigation
  - Jelly indicator animation

- `JellySegmentedControl.tsx`
  - Category selector
  - Same jelly motion as bottom tab indicator

- `GlassTopHeader.tsx`
  - Custom glass header
  - Replaces default Expo tab header

  ## AI Response Contract

The Moni frontend mock data follows the AI team's modular engine output format.

### AI engine entrypoint

```python
get_today_challenge(
    transactions_df,
    user_profile,
    category_settings_df,
    target_date
)
```

### Frontend mock source

```text
frontend/mobile/constants/mockAiResult.ts
```

### Main response shape

```ts
{
  user_id: string;
  category_name: string;
  challenge_date: string;
  challenge_type: string;
  challenge_text: string;
  difficulty: "Easy" | "Medium" | "Medium-Hard" | "Hard";
  status: "PENDING" | "SUCCESS" | "FAILED";
  xp_reward: number;
  ai_metadata: {
    budget_limit: number;
    predicted_monthly_spend: number;
    month_to_date_actual: number;
    predicted_remaining_spend: number;
    budget_pressure: number;
    model_used: "prophet" | "simple_average" | "no_data";
    reason: string;
    evaluated_categories: {
      category_name: string;
      model_used: "prophet" | "simple_average" | "no_data";
      budget_limit: number;
      predicted_monthly_spend: number;
      budget_pressure: number;
      is_daily_challenge: boolean;
      rank: number | null;
    }[];
  };
}
```

### Frontend display rules

- Use `predicted_monthly_spend`, not `projected_30d_total`.
- Label it as `이번 달 월말 예상 지출`.
- Use `budget_pressure` as the main AI decision score.
- Use `reason` as the challenge explanation.
- Use `evaluated_categories` for report/category comparison UI.
- Use `final_category` for AI category logic.
- Show `mydata_category` only as original category metadata.
- Keep budget settings inside the spending tab, not as a separate budget tab.

### Related frontend files

```text
frontend/mobile/constants/mockAiResult.ts
frontend/mobile/utils/aiFormat.ts
frontend/mobile/app/(tabs)/report.tsx
frontend/mobile/app/(tabs)/home.tsx
frontend/mobile/app/(tabs)/challenge.tsx
frontend/mobile/app/(tabs)/transactions.tsx
```