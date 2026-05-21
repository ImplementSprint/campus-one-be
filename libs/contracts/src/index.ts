export type ApiHealth = {
  status: 'ok';
  service: string;
};

export type SelectedSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  apiBaseUrl: string;
};
