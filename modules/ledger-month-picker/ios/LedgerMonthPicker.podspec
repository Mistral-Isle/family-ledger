Pod::Spec.new do |s|
  s.name = 'LedgerMonthPicker'
  s.version = '1.0.0'
  s.summary = 'Native year and month selection for the family ledger'
  s.description = s.summary
  s.author = 'Family Ledger'
  s.homepage = 'https://expo.dev'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
