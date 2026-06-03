// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {MAX_URL_LENGTH} from 'common/constants';
import {
    getFormattedPathName,
    isUrlType,
    isValidURL,
    isValidURI,
    parseURL,
    isInternalURL,
    isCallsPopOutURL,
    isTrustedURL,
} from 'common/utils/url';

describe('common/utils/url', () => {
    describe('getFormattedPathName', () => {
        it('should add trailing slash', () => {
            const unformattedPathName = '/aAbBbB/cC/DdeR';
            expect(getFormattedPathName(unformattedPathName)).toBe('/aAbBbB/cC/DdeR/');
        });
    });
    describe('parseURL', () => {
        it('should return the URL if it is already a URL', () => {
            const url = new URL('http://teamost.cn');
            expect(parseURL(url)).toBe(url);
        });

        it('should return undefined when a bad url is passed', () => {
            const badURL = 'not-a-real-url-at-all';
            expect(parseURL(badURL)).toBe(undefined);
        });

        it('should remove duplicate slashes in a URL when parsing', () => {
            const urlWithExtraSlashes = 'https://teamost.cn//sub//path//example';
            const parsedURL = parseURL(urlWithExtraSlashes);

            expect(parsedURL.toString()).toBe('https://teamost.cn/sub/path/example');
        });

        it('should preserve triple slashes for non-special schemes', () => {
            const onenoteUrl = 'onenote:///D:/OneNote/Test.one#section';
            const parsedURL = parseURL(onenoteUrl);

            expect(parsedURL).toBeDefined();
            expect(parsedURL.protocol).toBe('onenote:');
            expect(parsedURL.toString()).toBe(onenoteUrl);
        });

        it('should preserve file:/// URLs', () => {
            const fileUrl = 'file:///C:/Users/test.txt';
            const parsedURL = parseURL(fileUrl);

            expect(parsedURL).toBeDefined();
            expect(parsedURL.protocol).toBe('file:');
            expect(parsedURL.toString()).toBe(fileUrl);
        });

        it('should reject URLs with literal null bytes', () => {
            expect(parseURL('customproto:///path\x00malicious')).toBeUndefined();
        });

        it('should reject URLs with percent-encoded null bytes', () => {
            expect(parseURL('customproto:///path%00malicious')).toBeUndefined();
        });

        it('should reject URLs longer than the maximum allowed length', () => {
            const oversizedURL = `http://example.com/${'A'.repeat(MAX_URL_LENGTH)}`;
            expect(parseURL(oversizedURL)).toBeUndefined();
        });

        it('should accept URLs at exactly the maximum allowed length', () => {
            const prefix = 'http://example.com/';
            const padding = 'A'.repeat(MAX_URL_LENGTH - prefix.length);
            const maxLengthURL = `${prefix}${padding}`;
            expect(maxLengthURL.length).toBe(MAX_URL_LENGTH);
            expect(parseURL(maxLengthURL)).toBeDefined();
        });
    });

    describe('isValidURL', () => {
        it('should be true for a valid web url', () => {
            const testURL = 'https://developers.teamost.cn/';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https web url', () => {
            const testURL = 'http://developers.teamost.cn/';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for an invalid, self-defined, top-level domain', () => {
            const testURL = 'https://www.example.x';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a file download url', () => {
            const testURL = 'https://community.teamost.cn/api/v4/files/ka3xbfmb3ffnmgdmww8otkidfw?download=1';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a permalink url', () => {
            const testURL = 'https://community.teamost.cn/test-channel/pl/pdqowkij47rmbyk78m5hwc7r6r';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, internal domain', () => {
            const testURL = 'https://teamost.company-internal';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a second, valid internal domain', () => {
            const testURL = 'https://serverXY/mattermost';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https internal domain', () => {
            const testURL = 'http://mattermost.local';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https, ip address with port number', () => {
            const testURL = 'http://localhost:8065';
            expect(isValidURL(testURL)).toBe(true);
        });
    });
    describe('isValidURI', () => {
        it('should be true for a deeplink url', () => {
            const testURL = 'mattermost://community-release.teamost.cn/core/channels/developers';
            expect(isValidURI(testURL)).toBe(true);
        });
        it('should be false for a malicious url', () => {
            const testURL = String.raw`mattermost:///" --data-dir "\\deans-mbp\mattermost`;
            expect(isValidURI(testURL)).toBe(false);
        });
    });

    describe('isInternalURL', () => {
        it('should return false on different hosts', () => {
            const baseURL = new URL('http://teamost.cn');
            const externalURL = new URL('http://google.com');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different ports', () => {
            const baseURL = new URL('http://teamost.cn:8080');
            const externalURL = new URL('http://teamost.cn:9001');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different subpaths', () => {
            const baseURL = new URL('http://teamost.cn/sub/path/');
            const externalURL = new URL('http://teamost.cn/different/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return true if matching', () => {
            const baseURL = new URL('http://teamost.cn/');
            const externalURL = new URL('http://teamost.cn');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if matching with subpath', () => {
            const baseURL = new URL('http://teamost.cn/sub/path/');
            const externalURL = new URL('http://teamost.cn/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if subpath of', () => {
            const baseURL = new URL('http://teamost.cn/');
            const externalURL = new URL('http://teamost.cn/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('same host, different URL scheme, with ignore scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(isInternalURL(url1, url2, true)).toBe(true);
        });
    });
    describe('isTrustedURL', () => {
        it('base urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('different urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-2.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });

        it('same host, different subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('same host and subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com/subpath');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('same host, different URL scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });

        it('same host, different ports', () => {
            const url1 = new URL('http://server-1.com:8080');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });
    });

    describe('isUrlType', () => {
        const serverURL = new URL('http://teamost.cn');
        const urlType = 'url-type';

        it('should identify base url', () => {
            const adminURL = new URL(`http://teamost.cn/${urlType}`);
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(true);
        });

        it('should identify url of correct type', () => {
            const adminURL = new URL(`http://teamost.cn/${urlType}/some/path`);
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(true);
        });

        it('should not identify other url', () => {
            const adminURL = new URL('http://teamost.cn/some/other/path');
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(false);
        });
    });

    describe('isCallsPopOutURL', () => {
        it('should match correct URL', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should match with subpath', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org/subpath'),
                new URL('http://example.org/subpath/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should match with teamname with dash', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team-name/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should not match with invalid team name', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/invalid$team/com.mattermost.calls/expanded/othercallid'),
                'callid',
            )).toBe(false);
        });

        it('should not match with incorrect callid', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/othercallid'),
                'callid',
            )).toBe(false);
        });

        it('should not match with incorrect origin', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.com'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(false);
        });

        it('should match with regex path embedded', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.com/path(a+)+'),
                new URL('http://example.org//path\\(a\\+\\)\\+/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(false);
        });
    });
});
