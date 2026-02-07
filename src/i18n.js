import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  ru: {
    translation: {
      appName: 'Smart Notes',
      loading: 'Загрузка...',
      auth: {
        headline: 'Smart Notes',
        description:
          'Войдите, чтобы получить доступ к заметкам на всех устройствах и безопасно синхронизировать их.',
        continueWithGoogle: 'Продолжить с Google'
      },
      header: {
        account: 'Аккаунт',
        signOut: 'Выйти'
      },
      sidebar: {
        filters: 'Фильтры',
        allNotes: 'Все заметки',
        favorites: 'Избранные',
        quickLinks: 'Быстрый доступ',
        settings: 'Настройки',
        about: 'О нас',
        rate: 'Оценить'
      },
      home: {
        yourNotes: 'Ваши заметки',
        notesCount: '{{count}} всего заметок',
        searchPlaceholder: 'Поиск заметок'
      },
      notes: {
        emptyTitle: 'Заметок пока нет',
        emptyBody: 'Создайте новую заметку или измените запрос поиска, чтобы увидеть результаты.',
        previewPlaceholder: 'Начните писать, чтобы увидеть предпросмотр.',
        justNow: 'Только что',
        starred: 'В избранном',
        star: 'В избранное',
        archive: 'В архив',
        pin: 'Закрепить',
        move: 'В папку',
        delete: 'Удалить'
      },
      editor: {
        titlePlaceholder: 'Название заметки',
        contentPlaceholder: 'Начните писать заметку',
        close: 'Закрыть',
        save: 'Сохранить'
      },
      actions: {
        createNote: 'Создать заметку',
        signOut: 'Выйти'
      },
      defaults: {
        untitledNote: 'Без названия'
      }
    }
  },
  en: {
    translation: {
      appName: 'Smart Notes',
      loading: 'Loading...',
      auth: {
        headline: 'Smart Notes',
        description:
          'Sign in to access your notes across devices and keep them safely synced.',
        continueWithGoogle: 'Continue with Google'
      },
      header: {
        account: 'Account',
        signOut: 'Sign out'
      },
      sidebar: {
        filters: 'Filters',
        allNotes: 'All notes',
        favorites: 'Favorites',
        quickLinks: 'Quick links',
        settings: 'Settings',
        about: 'About',
        rate: 'Rate us'
      },
      home: {
        yourNotes: 'Your notes',
        notesCount: '{{count}} total notes',
        searchPlaceholder: 'Search notes'
      },
      notes: {
        emptyTitle: 'No notes yet',
        emptyBody: 'Create a new note or adjust your search to see results.',
        previewPlaceholder: 'Start writing to see a preview.',
        justNow: 'Just now',
        starred: 'Starred',
        star: 'Star',
        archive: 'Archive',
        pin: 'Pin',
        move: 'Move',
        delete: 'Delete'
      },
      editor: {
        titlePlaceholder: 'Note title',
        contentPlaceholder: 'Start writing your note',
        close: 'Close',
        save: 'Save'
      },
      actions: {
        createNote: 'Create note',
        signOut: 'Sign out'
      },
      defaults: {
        untitledNote: 'Untitled note'
      }
    }
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
